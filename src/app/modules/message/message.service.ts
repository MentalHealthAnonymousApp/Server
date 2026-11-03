import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import { appEventEmitter } from '../../events/eventEmitter';
import { TMessageApprovalStatus } from './message.interface';
import Message from './message.model';

// Helpers 

const maskContact = (email: string, phone: string): string => {
    // e.g. "jo***@gmail.com | ***-***-7890"
    const maskedEmail = email.replace(/^(.{2})(.*)(@.*)$/, (_, a, _b, c) => `${a}***${c}`);
    const maskedPhone = phone.replace(/\d(?=\d{4})/g, '*');
    return `${maskedEmail} | ${maskedPhone}`;
};

/*  User: create a message                                              */

const createMessageIntoDB = async (
    user: JwtPayload,
    payload: {
        recipientName?: string;
        recipientEmail: string;
        recipientPhone: string;
        recipientAge: string;
        recipientGender: string;
        recipientRelationship?: string;
        channel: 'sms' | 'email';
        topic: string;
        customNote?: string;
        articles?: string[];
    }
) => {
    if (!Types.ObjectId.isValid(payload.topic)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid topic ID');
    }

    if (payload.articles?.length) {
        const invalidArticle = payload.articles.find((id) => !Types.ObjectId.isValid(id));
        if (invalidArticle) {
            throw new AppError(StatusCodes.BAD_REQUEST, `Invalid article ID: ${invalidArticle}`);
        }
    }

    const maskedRecipient = maskContact(payload.recipientEmail, payload.recipientPhone);

    const message = await Message.create({
        sender: new Types.ObjectId(user.profileId),
        recipientName: payload.recipientName,
        recipientEmail: payload.recipientEmail.toLowerCase().trim(),
        recipientPhone: payload.recipientPhone.trim(),
        recipientAge: payload.recipientAge.trim(),
        recipientGender: payload.recipientGender,
        recipientRelationship: payload.recipientRelationship,
        maskedRecipient,
        channel: payload.channel,
        topic: new Types.ObjectId(payload.topic),
        customNote: payload.customNote,
        articles: (payload.articles ?? []).map((id) => new Types.ObjectId(id)),
        submittedAt: new Date(),
        status: 'pending',
        deliveryStatus: 'queued',
    });

    return message.populate([
        { path: 'topic', select: 'name slug tone icon' },
        { path: 'articles', select: 'title slug shortDescription' },
    ]);
};

/*  Admin: get all messages                                             */

const getAllMessagesFromDB = async (query: Record<string, unknown>) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { isDeleted: false };

    // status filter
    if (query.status) {
        filter.status = query.status;
    }

    // deliveryStatus filter
    if (query.deliveryStatus) {
        filter.deliveryStatus = query.deliveryStatus;
    }

    // channel filter
    if (query.channel) {
        filter.channel = query.channel;
    }

    // topic filter
    if (query.topic && Types.ObjectId.isValid(query.topic as string)) {
        filter.topic = new Types.ObjectId(query.topic as string);
    }

    // search on masked recipient
    if (query.searchTerm) {
        const regex = { $regex: String(query.searchTerm).trim(), $options: 'i' };
        filter.$or = [{ maskedRecipient: regex }, { recipientName: regex }];
    }

    const sortBy = (query.sortBy as string) || 'createdAt';
    const sortOrder = (query.sortOrder as string)?.toLowerCase() === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
        Message.find(filter)
            .populate('sender', 'firstName lastName email profile_image')
            .populate('topic', 'name slug tone icon')
            .populate('articles', 'title slug shortDescription')
            .sort(sort)
            .skip(skip)
            .limit(limit),
        Message.countDocuments(filter),
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

/*  Admin: get single message                                           */

const getSingleMessageFromDB = async (id: string) => {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid message ID');
    }

    const message = await Message.findOne({ _id: id, isDeleted: false })
        .populate('sender', 'firstName lastName email profile_image')
        .populate('topic', 'name slug tone icon')
        .populate('articles', 'title slug shortDescription');

    if (!message) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Message not found');
    }

    return message;
};

/*  Admin: update message status (approve / reject / etc.)             */

const updateMessageStatusIntoDB = async (
    id: string,
    payload: {
        status: TMessageApprovalStatus;
        rejectionReason?: string;
    }
) => {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid message ID');
    }

    if (payload.status === 'rejected' && !payload.rejectionReason?.trim()) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'A rejection reason is required when rejecting a message');
    }

    const message = await Message.findOne({ _id: id, isDeleted: false });
    if (!message) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Message not found');
    }

    const updateFields: Record<string, unknown> = {
        status: payload.status,
    };

    if (payload.status === 'approved') {
        updateFields.approvedAt = new Date();
        // TODO: Trigger email / SMS delivery here once the delivery utility is ready.
        // On successful send, update:
        //   status       → 'delivered'
        //   deliveryStatus → 'delivered'
        //   sentAt       → new Date()
    }

    if (payload.status === 'rejected') {
        updateFields.rejectionReason = payload.rejectionReason!.trim();
    } else {
        updateFields.rejectionReason = undefined;
    }

    const updated = await Message.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true }
    )
        .populate('sender', 'firstName lastName email profile_image')
        .populate('topic', 'name slug tone icon')
        .populate('articles', 'title slug shortDescription');

    // Notify the sender about the moderation decision
    if (message.sender) {
        const senderId = message.sender.toString();

        if (payload.status === 'approved') {
            appEventEmitter.emit('message:approved', {
                messageId: message._id,
                senderId,
            });
        } else if (payload.status === 'rejected') {
            appEventEmitter.emit('message:rejected', {
                messageId: message._id,
                senderId,
                reason: payload.rejectionReason,
            });
        }
    }

    return updated;
};

/* ------------------------------------------------------------------ */
/*  Admin: soft-delete a message                                        */
/* ------------------------------------------------------------------ */

const deleteMessageFromDB = async (id: string) => {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid message ID');
    }

    const deleted = await Message.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { $set: { isDeleted: true } },
        { new: true }
    );

    if (!deleted) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Message not found');
    }

    return deleted;
};

/* ------------------------------------------------------------------ */
/*  User: get own messages                                              */
/* ------------------------------------------------------------------ */

const getMyMessagesFromDB = async (
    user: JwtPayload,
    query: Record<string, unknown>
) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
        sender: new Types.ObjectId(user.profileId),
        isDeleted: false,
    };

    if (query.status) {
        filter.status = query.status;
    }

    const [data, total] = await Promise.all([
        Message.find(filter)
            .populate('topic', 'name slug tone icon')
            .populate('articles', 'title slug shortDescription')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Message.countDocuments(filter),
    ]);

    return {
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        data,
    };
};

export const MessageServices = {
    createMessageIntoDB,
    getAllMessagesFromDB,
    getSingleMessageFromDB,
    updateMessageStatusIntoDB,
    deleteMessageFromDB,
    getMyMessagesFromDB,
};

export default MessageServices;

