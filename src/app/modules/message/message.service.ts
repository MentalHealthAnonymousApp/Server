import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import { createHash } from 'crypto';
import AppError from '../../error/appError';
import { appEventEmitter } from '../../events/eventEmitter';
import { TDeliveryChannel, TMessageApprovalStatus } from './message.interface';
import Message from './message.model';
import Topic from '../topic/topic.model';
import Resource from '../resource/resource.model';
import sendEmail from '../../utilities/sendEmail';
import sendSMS from '../../helper/sendSms';
import { createMessageEmail, createMessageSms, getResourceUrl } from './message.template';
import PackagePurchase from '../package_purchase/package_purchase.model';
import { errorLogger } from '../../shared/logger';

// Helpers 

const maskContact = (channel: TDeliveryChannel, email?: string, phone?: string): string => {
    if (channel === 'email' && email) {
        const [local = '', domain = ''] = email.split('@');
        return `${local.slice(0, 1)}***@${domain}`;
    }
    if (channel === 'sms' && phone) {
        return phone.replace(/\d(?=\d{4})/g, '*');
    }
    return '***';
};

/*  User: create a message                                              */

const createMessageIntoDB = async (
    user: JwtPayload,
    payload: {
        recipientName?: string;
        recipientEmail?: string;
        recipientPhone?: string;
        channel: 'sms' | 'email';
        topic: string;
        packagePurchaseId: string;
        customNote?: string;
        articles?: string[];
    },
    idempotencyKey: string
) => {
    const senderId = user.profileId;
    if (!Types.ObjectId.isValid(senderId)) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'Authenticated user profile is invalid');
    }
    if (!Types.ObjectId.isValid(payload.packagePurchaseId)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'A valid package purchase is required');
    }

    const topicConditions: Record<string, unknown>[] = [{ slug: payload.topic }];
    if (Types.ObjectId.isValid(payload.topic)) {
        topicConditions.push({ _id: new Types.ObjectId(payload.topic) });
    }
    const topic = await Topic.findOne({ isDeleted: false, $or: topicConditions }).select('_id name slug');
    if (!topic) throw new AppError(StatusCodes.NOT_FOUND, 'Selected topic was not found');

    const articleIds = [...new Set(payload.articles ?? [])];
    if (articleIds.length > 5) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'You can attach up to 5 resources');
    }
    if (articleIds.some((id) => !Types.ObjectId.isValid(id))) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'One or more selected resource IDs are invalid');
    }
    const purchase = await PackagePurchase.findOne({
        _id: payload.packagePurchaseId,
        userId: new Types.ObjectId(senderId),
        billingProvider: { $in: ['stripe', 'apple_app_store', 'google_play'] },
        isDeleted: false,
    }).select('packageTier fulfillmentStatus messageId status');
    if (!purchase) {
        throw new AppError(StatusCodes.PAYMENT_REQUIRED, 'A confirmed package purchase is required to send a message');
    }
    if (purchase.packageTier === 'basic' && articleIds.length > 0) {
        throw new AppError(StatusCodes.FORBIDDEN, 'The Basic package does not include resource attachments');
    }

    const resources = articleIds.length
        ? await Resource.find({
              _id: { $in: articleIds.map((id) => new Types.ObjectId(id)) },
              status: 'published',
              isDeleted: false,
          }).select('_id slug title topic')
        : [];
    if (resources.length !== articleIds.length) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'One or more selected resources are unavailable');
    }

    const normalizedEmail = payload.channel === 'email' ? payload.recipientEmail?.trim().toLowerCase() : undefined;
    const normalizedPhone = payload.channel === 'sms' ? payload.recipientPhone?.trim() : undefined;
    if (payload.channel === 'email' && !normalizedEmail) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Recipient email is required for email delivery');
    }
    if (payload.channel === 'sms' && !normalizedPhone) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Recipient phone is required for SMS delivery');
    }

    const templateResources = resources.map((resource) => ({
        title: resource.title,
        url: getResourceUrl({ id: resource._id.toString(), slug: resource.slug }),
    }));
    const templateInput = {
        recipientName: payload.recipientName,
        customNote: payload.customNote,
        topicName: topic.name,
        resources: templateResources,
    };
    const emailTemplate = payload.channel === 'email' ? createMessageEmail(templateInput) : undefined;
    const smsText = payload.channel === 'sms' ? createMessageSms(templateInput) : undefined;
    if (smsText && smsText.length > 1600) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'SMS content is too long. Remove a resource or shorten the note.');
    }
    const requestHash = createHash('sha256')
        .update(
            JSON.stringify({
                channel: payload.channel,
                recipient: normalizedEmail || normalizedPhone,
                recipientName: payload.recipientName?.trim() || '',
                topic: topic._id.toString(),
                packagePurchaseId: payload.packagePurchaseId,
                customNote: payload.customNote?.trim() || '',
                articles: articleIds.sort(),
            })
        )
        .digest('hex');
    const existing = await Message.findOne({ sender: senderId, idempotencyKey }).select('+idempotencyHash');
    if (existing) {
        if (existing.idempotencyHash !== requestHash) {
            throw new AppError(StatusCodes.CONFLICT, 'This idempotency key was already used for a different message');
        }
        if (existing.deliveryStatus === 'failed') {
            throw new AppError(StatusCodes.BAD_GATEWAY, 'The previous delivery attempt failed. Contact support before retrying to avoid duplicate delivery.');
        }
        return { messageId: existing._id.toString(), status: existing.deliveryStatus };
    }
    if (
        purchase.status !== 'completed' ||
        purchase.fulfillmentStatus !== 'pending' ||
        purchase.messageId
    ) {
        throw new AppError(StatusCodes.PAYMENT_REQUIRED, 'This package credit has already been used or is no longer available');
    }

    let message;
    try {
        message = await Message.create({
        sender: new Types.ObjectId(senderId),
        packagePurchaseId: new Types.ObjectId(payload.packagePurchaseId),
        idempotencyKey,
        idempotencyHash: requestHash,
        attestedAt: new Date(),
        recipientName: payload.recipientName?.trim(),
        recipientEmail: normalizedEmail,
        recipientPhone: normalizedPhone,
        maskedRecipient: maskContact(payload.channel, normalizedEmail, normalizedPhone),
        channel: payload.channel,
        topic: topic._id,
        customNote: payload.customNote?.trim(),
        articles: resources.map((resource) => resource._id),
        submittedAt: new Date(),
        status: 'approved',
        deliveryStatus: 'queued',
        approvedAt: new Date(),
    });
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            const duplicate = await Message.findOne({ sender: senderId, idempotencyKey }).select('+idempotencyHash');
            if (duplicate?.idempotencyHash === requestHash) {
                return { messageId: duplicate._id.toString(), status: duplicate.deliveryStatus };
            }
            throw new AppError(StatusCodes.CONFLICT, 'This idempotency key was already used');
        }
        throw error;
    }

    const reservedPurchase = await PackagePurchase.findOneAndUpdate(
        {
            _id: payload.packagePurchaseId,
            userId: new Types.ObjectId(senderId),
            status: 'completed',
            fulfillmentStatus: 'pending',
            isDeleted: false,
            messageId: { $exists: false },
        },
        { $set: { messageId: message._id } },
        { new: true }
    );
    if (!reservedPurchase) {
        await Message.deleteOne({ _id: message._id });
        throw new AppError(StatusCodes.PAYMENT_REQUIRED, 'This package credit has already been used or is no longer available');
    }

    try {
        if (payload.channel === 'email') {
            await sendEmail({
                email: normalizedEmail!,
                subject: emailTemplate!.subject,
                html: emailTemplate!.html,
            });
        } else {
            await sendSMS(normalizedPhone!, smsText!);
        }
    } catch (error) {
        await Message.updateOne(
            { _id: message._id },
            { $set: { deliveryStatus: 'failed' } }
        );
        await PackagePurchase.updateOne(
            {
                _id: payload.packagePurchaseId,
                messageId: message._id,
                fulfillmentStatus: 'pending',
            },
            { $unset: { messageId: 1 } }
        );
        if (error instanceof AppError) throw error;
        throw new AppError(StatusCodes.BAD_GATEWAY, 'The delivery provider did not confirm the message. Contact support before retrying to avoid duplicate delivery.');
    }

    await Message.updateOne(
        { _id: message._id },
        { $set: { status: 'approved', deliveryStatus: 'queued', sentAt: new Date() } }
    );
    const consumedPurchase = await PackagePurchase.updateOne(
        {
            _id: payload.packagePurchaseId,
            messageId: message._id,
            fulfillmentStatus: 'pending',
        },
        { $set: { fulfillmentStatus: 'fulfilled', messageUsedAt: new Date() } }
    );
    if (consumedPurchase.modifiedCount !== 1) {
        errorLogger.error(`Message ${message._id.toString()} was sent but its package credit could not be consumed`);
        throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'The message was sent but package usage could not be recorded. Contact support before trying again.');
    }
    return { messageId: message._id.toString(), status: 'queued' as const };
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

const getSingleMessageFromDB = async (id: string, requester: JwtPayload) => {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid message ID');
    }

    const filter: Record<string, unknown> = { _id: id, isDeleted: false };
    if (requester.role === 'user') {
        filter.sender = requester.profileId;
    }

    const message = await Message.findOne(filter)
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
