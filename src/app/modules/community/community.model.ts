import { Schema, model } from 'mongoose';
import {
    CommunityPostDocument,
    CommunityPostModel,
    CommunityReplyDocument,
    CommunityReplyModel,
} from './community.interface';
import { COMMUNITY_POST_STATUS } from './community.constant';

const communityReplySchema = new Schema<CommunityReplyDocument, CommunityReplyModel>(
    {
        postId: {
            type: Schema.Types.ObjectId,
            ref: 'CommunityPost',
            required: true,
            index: true,
        },
        authorId: {
            type: Schema.Types.ObjectId,
            ref: 'NormalUser',
        },
        authorName: {
            type: String,
            required: true,
            trim: true,
            default: 'Anonymous Member',
        },
        authorBadge: {
            type: String,
            trim: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        likesCount: {
            type: Number,
            default: 0,
        },
        likedBy: [
            {
                type: Schema.Types.ObjectId,
                ref: 'NormalUser',
            },
        ],
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

export const CommunityReply = model<CommunityReplyDocument, CommunityReplyModel>(
    'CommunityReply',
    communityReplySchema
);

const communityPostSchema = new Schema<CommunityPostDocument, CommunityPostModel>(
    {
        authorId: {
            type: Schema.Types.ObjectId,
            ref: 'NormalUser',
            index: true,
        },
        authorName: {
            type: String,
            required: true,
            trim: true,
            default: 'Anonymous Member',
        },
        authorRole: {
            type: String,
            default: 'Community Member',
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            default: 'General Discussion',
            index: true,
        },
        topicTag: {
            type: String,
            default: 'Discussion',
        },
        imageUrl: {
            type: String,
            default: '',
        },
        likesCount: {
            type: Number,
            default: 0,
        },
        likedBy: [
            {
                type: Schema.Types.ObjectId,
                ref: 'NormalUser',
            },
        ],
        repliesCount: {
            type: Number,
            default: 0,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: COMMUNITY_POST_STATUS,
            default: 'approved',
            index: true,
        },
        feedback: {
            type: String,
        },
        rejectionReason: {
            type: String,
        },
        reviewedAt: {
            type: Date,
        },
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

export const CommunityPost = model<CommunityPostDocument, CommunityPostModel>(
    'CommunityPost',
    communityPostSchema
);
export default CommunityPost;

