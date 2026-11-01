import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import { USER_ROLE } from '../user/user.constant';
import { CommunityReply, default as CommunityPost } from './community.model';
import { ICommunityPost, TCommunityPostStatus } from './community.interface';
import { COMMUNITY_CATEGORIES, COMMUNITY_POST_STATUS } from './community.constant';
import { appEventEmitter } from '../../events/eventEmitter';

const PAGE_LIMIT_MAX = 100;
const POST_SORT_FIELDS = ['createdAt', 'updatedAt', 'likesCount', 'repliesCount', 'isPinned'];

const getObjectId = (id: string, label: string): Types.ObjectId => {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(StatusCodes.BAD_REQUEST, `Invalid ${label}`);
    }

    return new Types.ObjectId(id);
};

const getPagination = (query: Record<string, unknown>) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(PAGE_LIMIT_MAX, Math.max(1, Number(query.limit) || 10));

    return { page, limit, skip: (page - 1) * limit };
};

const getAllCommunityPostsFromDB = async (
    query: Record<string, unknown>,
    includeUnapproved = false
) => {
    const { page, limit, skip } = getPagination(query);
    const filter: Record<string, unknown> = { isDeleted: false };

    if (!includeUnapproved) {
        filter.status = 'approved';
    } else if (query.status && query.status !== 'all') {
        if (
            typeof query.status !== 'string' ||
            !COMMUNITY_POST_STATUS.includes(query.status as (typeof COMMUNITY_POST_STATUS)[number])
        ) {
            throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid community post status');
        }
        filter.status = query.status;
    }

    const searchTerm = String(query.searchTerm || query.search || '').trim();
    if (searchTerm) {
        const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = { $regex: escapedSearch, $options: 'i' };
        filter.$or = [{ title: regex }, { content: regex }];
    }

    const category = query.category as COMMUNITY_CATEGORIES | undefined;
    if (query.category !== undefined && query.category !== '') {
        if (
            typeof query.category !== 'string' ||
            !Object.values(COMMUNITY_CATEGORIES).includes(query.category as COMMUNITY_CATEGORIES)
        ) {
            throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid community category');
        }
    }
    if (category && category !== COMMUNITY_CATEGORIES.ALL_DISCUSSIONS) {
        filter.category = category;
    }

    if (includeUnapproved && query.author) {
        if (typeof query.author !== 'string' || !Types.ObjectId.isValid(query.author)) {
            throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid community author ID');
        }
        filter.author = new Types.ObjectId(query.author);
    }

    const sortBy = POST_SORT_FIELDS.includes(String(query.sortBy))
        ? String(query.sortBy)
        : 'createdAt';
    const sortOrder = String(query.sortOrder).toLowerCase() === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { isPinned: -1, [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
        CommunityPost.find(filter)
            .populate('author', 'fullName firstName lastName profile_image role')
            .sort(sort)
            .skip(skip)
            .limit(limit),
        CommunityPost.countDocuments(filter),
    ]);

    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data,
    };
};

const getSingleCommunityPostFromDB = async (id: string, includeUnapproved = false) => {
    const filter: Record<string, unknown> = {
        _id: getObjectId(id, 'community post ID'),
        isDeleted: false,
    };
    if (!includeUnapproved) {
        filter.status = 'approved';
    }

    const post = await CommunityPost.findOne(filter).populate(
        'author',
        'fullName firstName lastName profile_image role'
    );
    if (!post) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Community post not found');
    }

    return post;
};

const createCommunityPostIntoDB = async (profileId: string, payload: Partial<ICommunityPost>) => {
    const author = getObjectId(profileId, 'community profile ID');
    const post = await CommunityPost.create({
        ...payload,
        author,
        status: 'pending',
    });

    // Notify admin about new pending post
    appEventEmitter.emit('community:post:submitted', {
        postId: post._id.toString(),
        authorId: profileId,
        title: post.title,
    });

    return post.populate('author', 'fullName firstName lastName profile_image role');
};

const updateCommunityPostIntoDB = async (
    id: string,
    profileId: string,
    payload: Partial<ICommunityPost>
) => {
    const postId = getObjectId(id, 'community post ID');
    const authorId = getObjectId(profileId, 'community profile ID');
    const post = await CommunityPost.findOne({ _id: postId, isDeleted: false });

    if (!post) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Community post not found');
    }
    if (post.author.toString() !== authorId.toString()) {
        throw new AppError(StatusCodes.FORBIDDEN, 'You can only update your own posts');
    }
    if (post.status !== 'pending' && post.status !== 'needs_update') {
        throw new AppError(StatusCodes.FORBIDDEN, 'Only pending posts can be edited');
    }

    const updated = await CommunityPost.findByIdAndUpdate(
        postId,
        {
            $set: { ...payload, status: 'pending' },
            $unset: { feedback: 1, rejectionReason: 1, reviewedAt: 1, reviewedBy: 1 },
        },
        { new: true, runValidators: true }
    ).populate('author', 'fullName firstName lastName profile_image role');

    if (!updated) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Community post not found');
    }

    return updated;
};

const deleteCommunityPostFromDB = async (
    id: string,
    profileId: string,
    role: string
) => {
    const postId = getObjectId(id, 'community post ID');
    const post = await CommunityPost.findOne({ _id: postId, isDeleted: false });

    if (!post) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Community post not found');
    }

    if (role !== USER_ROLE.admin && role !== USER_ROLE.superAdmin) {
        const authorId = getObjectId(profileId, 'community profile ID');
        if (post.author.toString() !== authorId.toString()) {
            throw new AppError(StatusCodes.FORBIDDEN, 'You can only delete your own posts');
        }
    }

    post.isDeleted = true;
    await post.save();
    return post;
};

const moderateCommunityPostIntoDB = async (
    id: string,
    reviewerProfileId: string,
    payload: {
        status: TCommunityPostStatus;
        feedback?: string;
        rejectionReason?: string;
    }
) => {
    if (payload.status === 'needs_update' && !payload.feedback?.trim()) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Feedback is required for needs_update status');
    }
    if (payload.status === 'rejected' && !payload.rejectionReason?.trim()) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'A rejection reason is required');
    }

    const updated = await CommunityPost.findOneAndUpdate(
        { _id: getObjectId(id, 'community post ID'), isDeleted: false },
        {
            $set: {
                status: payload.status,
                reviewedAt: new Date(),
                reviewedBy: getObjectId(reviewerProfileId, 'reviewer profile ID'),
                ...(payload.status === 'needs_update' ? { feedback: payload.feedback?.trim() } : {}),
                ...(payload.status === 'rejected'
                    ? { rejectionReason: payload.rejectionReason?.trim() }
                    : {}),
            },
            $unset: {
                ...(payload.status !== 'needs_update' ? { feedback: 1 } : {}),
                ...(payload.status !== 'rejected' ? { rejectionReason: 1 } : {}),
            },
        },
        { new: true, runValidators: true }
    );

    if (!updated) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Community post not found');
    }

    // Emit moderation event before populate (author is still ObjectId)
    const authorId = updated.author.toString();
    const postId = updated._id.toString();
    const postTitle = updated.title;

    if (payload.status === 'approved') {
        appEventEmitter.emit('community:post:approved', {
            postId,
            authorId,
            title: postTitle,
        });
    } else if (payload.status === 'rejected') {
        appEventEmitter.emit('community:post:rejected', {
            postId,
            authorId,
            title: postTitle,
            reason: payload.rejectionReason ?? '',
        });
    } else if (payload.status === 'needs_update') {
        appEventEmitter.emit('community:post:needs_update', {
            postId,
            authorId,
            title: postTitle,
            feedback: payload.feedback ?? '',
        });
    }

    return updated.populate('author', 'fullName firstName lastName profile_image role');
};

const toggleCommunityPostLikeInDB = async (id: string, profileId: string) => {
    const postId = getObjectId(id, 'community post ID');
    const authorId = getObjectId(profileId, 'community profile ID');
    const likedPost = await CommunityPost.findOneAndUpdate(
        {
            _id: postId,
            isDeleted: false,
            status: 'approved',
            likedBy: { $ne: authorId },
        },
        { $addToSet: { likedBy: authorId }, $inc: { likesCount: 1 } },
        { new: true }
    );

    if (likedPost) {
        // Notify post author (if different from liker)
        if (likedPost.author.toString() !== authorId.toString()) {
            appEventEmitter.emit('community:post:liked', {
                postId: postId.toString(),
                authorId: likedPost.author.toString(),
                likerName: 'A community member',
            });
        }
        return likedPost.populate('author', 'fullName firstName lastName profile_image role');
    }

    const unlikedPost = await CommunityPost.findOneAndUpdate(
        { _id: postId, isDeleted: false, status: 'approved', likedBy: authorId },
        { $pull: { likedBy: authorId }, $inc: { likesCount: -1 } },
        { new: true }
    );
    if (unlikedPost) {
        return unlikedPost.populate('author', 'fullName firstName lastName profile_image role');
    }

    throw new AppError(StatusCodes.NOT_FOUND, 'Approved community post not found');
};

const getCommunityRepliesFromDB = async (
    postId: string,
    query: Record<string, unknown>
) => {
    const parentPost = await CommunityPost.findOne({
        _id: getObjectId(postId, 'community post ID'),
        isDeleted: false,
        status: 'approved',
    }).select('_id');
    if (!parentPost) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Approved community post not found');
    }

    const { page, limit, skip } = getPagination(query);
    const [data, total] = await Promise.all([
        CommunityReply.find({ post: parentPost._id })
            .populate('author', 'fullName firstName lastName profile_image role')
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit),
        CommunityReply.countDocuments({ post: parentPost._id }),
    ]);

    return {
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        data,
    };
};

const createCommunityReplyInDB = async (
    postId: string,
    profileId: string,
    content: string
) => {
    const authorId = getObjectId(profileId, 'community profile ID');
    const parentPost = await CommunityPost.findOne(
        {
            _id: getObjectId(postId, 'community post ID'),
            isDeleted: false,
            status: 'approved',
        }
    ).select('_id author title');
    if (!parentPost) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Approved community post not found');
    }

    const reply = await CommunityReply.create({
        post: parentPost._id,
        author: authorId,
        content,
    });
    const updatedPost = await CommunityPost.updateOne(
        { _id: parentPost._id, isDeleted: false, status: 'approved' },
        { $inc: { repliesCount: 1 } }
    );
    if (!updatedPost.modifiedCount) {
        await CommunityReply.deleteOne({ _id: reply._id });
        throw new AppError(StatusCodes.NOT_FOUND, 'Approved community post not found');
    }

    // Notify post author about reply (if different from replier)
    if (parentPost.author.toString() !== authorId.toString()) {
        appEventEmitter.emit('community:reply:created', {
            postId: postId,
            postAuthorId: parentPost.author.toString(),
            replierName: 'A user',
            postTitle: parentPost.title,
        });
    }

    return reply.populate('author', 'fullName firstName lastName profile_image role');
};

const deleteCommunityReplyFromDB = async (
    postId: string,
    replyId: string,
    profileId: string,
    role: string
) => {
    const parentPostId = getObjectId(postId, 'community post ID');
    const replyObjectId = getObjectId(replyId, 'community reply ID');
    const reply = await CommunityReply.findOne({ _id: replyObjectId, post: parentPostId });

    if (!reply) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Community reply not found');
    }

    if (role !== USER_ROLE.admin && role !== USER_ROLE.superAdmin) {
        const authorId = getObjectId(profileId, 'community profile ID');
        if (reply.author.toString() !== authorId.toString()) {
            throw new AppError(StatusCodes.FORBIDDEN, 'You can only delete your own replies');
        }
    }

    const deletedReply = await CommunityReply.findOneAndDelete({
        _id: replyObjectId,
        post: parentPostId,
    });
    if (!deletedReply) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Community reply not found');
    }

    await CommunityPost.updateOne(
        { _id: parentPostId, isDeleted: false, repliesCount: { $gt: 0 } },
        { $inc: { repliesCount: -1 } }
    );

    return deletedReply;
};

export const CommunityServices = {
    getAllCommunityPostsFromDB,
    getSingleCommunityPostFromDB,
    createCommunityPostIntoDB,
    updateCommunityPostIntoDB,
    deleteCommunityPostFromDB,
    moderateCommunityPostIntoDB,
    toggleCommunityPostLikeInDB,
    getCommunityRepliesFromDB,
    createCommunityReplyInDB,
    deleteCommunityReplyFromDB,
};

export default CommunityServices;
