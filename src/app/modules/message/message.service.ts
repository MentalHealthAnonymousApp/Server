import { JwtPayload } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import { createHash, randomBytes } from 'crypto';
import AppError from '../../error/appError';
import { appEventEmitter } from '../../events/eventEmitter';
import { TDeliveryChannel, TMessageApprovalStatus } from './message.interface';
import Message from './message.model';
import Topic from '../topic/topic.model';
import Resource from '../resource/resource.model';
import sendEmail from '../../utilities/sendEmail';
import sendSMS from '../../helper/sendSms';
import { createMessageEmail, createMessageSms, getReportUrl, getResourceUrl } from './message.template';
import PackagePurchase from '../package_purchase/package_purchase.model';
import { errorLogger, logger } from '../../shared/logger';
import {
    DELIVERY_CHANNELS,
    DELIVERY_STATUS,
    MESSAGE_APPROVAL_STATUS,
    MESSAGE_AUTO_APPROVE_AFTER_MS,
    MESSAGE_AUTO_APPROVE_BATCH_SIZE,
} from './message.constant';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const ADMIN_POPULATE = [
    { path: 'sender', select: 'firstName lastName email phone profile_image' },
    { path: 'topic', select: 'name slug tone icon' },
    { path: 'articles', select: 'title slug shortDescription' },
];

const newReportToken = () => randomBytes(24).toString('base64url');

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

/** Accepts a query value only if it's a plain string in the allowed list (blocks `?status[$ne]=x`). */
const pickEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

/**
 * Returns a message's package credit to the user (unused) — or marks it failed if the purchase
 * is no longer in good standing (refunded / disputed). Single atomic pipeline update.
 */
const restorePackageCredit = (purchaseId: Types.ObjectId, messageId: Types.ObjectId) =>
    PackagePurchase.updateOne({ _id: purchaseId, messageId }, [
        {
            $set: {
                fulfillmentStatus: {
                    $cond: [{ $eq: ['$status', 'completed'] }, 'pending', 'failed'],
                },
            },
        },
        { $unset: ['messageId', 'messageUsedAt'] },
    ]);

/* ------------------------------------------------------------------ */
/*  User: submit a message (goes to admin review)                       */
/* ------------------------------------------------------------------ */

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

    const articleIds = [...new Set(payload.articles ?? [])];
    if (articleIds.length > 5) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'You can attach up to 5 resources');
    }
    if (articleIds.some((id) => !Types.ObjectId.isValid(id))) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'One or more selected resource IDs are invalid');
    }

    // Independent lookups run in parallel.
    const [topic, purchase, resources] = await Promise.all([
        Topic.findOne({ isDeleted: false, $or: topicConditions }).select('_id name slug'),
        PackagePurchase.findOne({
            _id: payload.packagePurchaseId,
            userId: new Types.ObjectId(senderId),
            billingProvider: { $in: ['stripe', 'apple_app_store', 'google_play'] },
            isDeleted: false,
        }).select('packageTier fulfillmentStatus messageId status'),
        articleIds.length
            ? Resource.find({
                  _id: { $in: articleIds.map((id) => new Types.ObjectId(id)) },
                  status: 'published',
                  isDeleted: false,
              }).select('_id slug title topic')
            : Promise.resolve([]),
    ]);

    if (!topic) throw new AppError(StatusCodes.NOT_FOUND, 'Selected topic was not found');
    if (!purchase) {
        throw new AppError(StatusCodes.PAYMENT_REQUIRED, 'A confirmed package purchase is required to send a message');
    }
    if (purchase.packageTier === 'basic' && articleIds.length > 0) {
        throw new AppError(StatusCodes.FORBIDDEN, 'The Basic package does not include resource attachments');
    }
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

    const reportToken = newReportToken();

    // Validate SMS length up front so the user can fix it now rather than it failing after approval.
    if (payload.channel === 'sms') {
        const smsText = createMessageSms({
            reportUrl: getReportUrl(reportToken),
            recipientName: payload.recipientName,
            customNote: payload.customNote,
            topicName: topic.name,
            resources: resources.map((resource) => ({
                title: resource.title,
                url: getResourceUrl({ id: resource._id.toString(), slug: resource.slug }),
            })),
        });
        if (smsText.length > 1600) {
            throw new AppError(StatusCodes.BAD_REQUEST, 'SMS content is too long. Remove a resource or shorten the note.');
        }
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
        return { messageId: existing._id.toString(), status: existing.status, autoApproveAt: existing.autoApproveAt };
    }
    if (
        purchase.status !== 'completed' ||
        purchase.fulfillmentStatus !== 'pending' ||
        purchase.messageId
    ) {
        throw new AppError(StatusCodes.PAYMENT_REQUIRED, 'This package credit has already been used or is no longer available');
    }

    const now = new Date();
    const autoApproveAt = new Date(now.getTime() + MESSAGE_AUTO_APPROVE_AFTER_MS);

    let message;
    try {
        message = await Message.create({
            sender: new Types.ObjectId(senderId),
            packagePurchaseId: new Types.ObjectId(payload.packagePurchaseId),
            idempotencyKey,
            idempotencyHash: requestHash,
            reportToken,
            attestedAt: now,
            recipientName: payload.recipientName?.trim(),
            recipientEmail: normalizedEmail,
            recipientPhone: normalizedPhone,
            maskedRecipient: maskContact(payload.channel, normalizedEmail, normalizedPhone),
            channel: payload.channel,
            topic: topic._id,
            customNote: payload.customNote?.trim(),
            articles: resources.map((resource) => resource._id),
            submittedAt: now,
            status: 'pending',
            deliveryStatus: 'queued',
            autoApproveAt,
        });
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            const duplicate = await Message.findOne({ sender: senderId, idempotencyKey }).select('+idempotencyHash');
            if (duplicate?.idempotencyHash === requestHash) {
                return { messageId: duplicate._id.toString(), status: duplicate.status, autoApproveAt: duplicate.autoApproveAt };
            }
            throw new AppError(StatusCodes.CONFLICT, 'This idempotency key was already used');
        }
        throw error;
    }

    // Mark the package credit as used now. It is returned if the admin rejects the message.
    const reservedPurchase = await PackagePurchase.updateOne(
        {
            _id: payload.packagePurchaseId,
            userId: new Types.ObjectId(senderId),
            status: 'completed',
            fulfillmentStatus: 'pending',
            isDeleted: false,
            messageId: { $exists: false },
        },
        { $set: { messageId: message._id, fulfillmentStatus: 'fulfilled', messageUsedAt: now } }
    );
    if (reservedPurchase.modifiedCount !== 1) {
        await Message.deleteOne({ _id: message._id });
        throw new AppError(StatusCodes.PAYMENT_REQUIRED, 'This package credit has already been used or is no longer available');
    }

    appEventEmitter.emit('message:submitted', { messageId: message._id.toString(), topicName: topic.name });

    return { messageId: message._id.toString(), status: 'pending' as const, autoApproveAt };
};

/* ------------------------------------------------------------------ */
/*  Delivery (shared by admin approval and auto-approval)               */
/* ------------------------------------------------------------------ */

/**
 * Atomically claims a message for delivery. Only one caller (admin click, retry, or the
 * auto-approval job) can win the claim, so a message is never sent twice.
 * Claimable: pending messages, or approved messages whose previous delivery failed (retry).
 */
const claimMessageForDelivery = (id: string, reviewerId?: string) => {
    const now = new Date();
    return Message.findOneAndUpdate(
        {
            _id: id,
            isDeleted: false,
            $or: [{ status: 'pending' }, { status: 'approved', deliveryStatus: 'failed' }],
        },
        {
            $set: {
                status: 'approved',
                deliveryStatus: 'queued',
                approvedAt: now,
                reviewedAt: now,
                autoApproved: !reviewerId,
                ...(reviewerId && Types.ObjectId.isValid(reviewerId)
                    ? { reviewedBy: new Types.ObjectId(reviewerId) }
                    : {}),
            },
            $unset: { deliveryError: 1, rejectionReason: 1 },
        },
        { new: true }
    )
        .select('+reportToken')
        .populate('topic', 'name')
        .populate({
            path: 'articles',
            select: 'title slug',
            match: { status: 'published', isDeleted: false },
        });
};

type ClaimedMessage = NonNullable<Awaited<ReturnType<typeof claimMessageForDelivery>>>;

const deliverClaimedMessage = async (message: ClaimedMessage): Promise<'delivered' | 'failed' | 'invalid'> => {
    const messageId = message._id;

    // The package may have been refunded/disputed while the message waited for review.
    const purchaseValid = await PackagePurchase.exists({
        _id: message.packagePurchaseId,
        messageId,
        status: 'completed',
        isDeleted: false,
    });
    if (!purchaseValid) {
        await Message.updateOne(
            { _id: messageId },
            {
                $set: {
                    status: 'rejected',
                    rejectionReason: 'The package payment for this message is no longer valid (refunded or disputed).',
                },
            }
        );
        return 'invalid';
    }

    // Messages created before report links existed get a token at send time.
    let reportToken = message.reportToken;
    if (!reportToken) {
        reportToken = newReportToken();
        await Message.updateOne({ _id: messageId }, { $set: { reportToken } });
    }

    const topic = message.topic as unknown as { name?: string } | null;
    const articles = (message.articles as unknown as { _id: Types.ObjectId; title: string; slug?: string }[]).filter(Boolean);
    const templateInput = {
        reportUrl: getReportUrl(reportToken),
        recipientName: message.recipientName,
        customNote: message.customNote,
        topicName: topic?.name ?? 'Mental health support',
        resources: articles.map((resource) => ({
            title: resource.title,
            url: getResourceUrl({ id: resource._id.toString(), slug: resource.slug }),
        })),
    };

    try {
        if (message.channel === 'email') {
            if (!message.recipientEmail) throw new Error('Recipient email is missing');
            const email = createMessageEmail(templateInput);
            await sendEmail({ email: message.recipientEmail, subject: email.subject, html: email.html });
        } else {
            if (!message.recipientPhone) throw new Error('Recipient phone is missing');
            await sendSMS(message.recipientPhone, createMessageSms(templateInput));
        }
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await Message.updateOne(
            { _id: messageId },
            { $set: { deliveryStatus: 'failed', deliveryError: reason.slice(0, 500) } }
        );
        errorLogger.error(`Message ${messageId.toString()} delivery failed after approval`);
        return 'failed';
    }

    await Message.updateOne(
        { _id: messageId },
        { $set: { status: 'delivered', deliveryStatus: 'delivered', sentAt: new Date() } }
    );

    if (message.sender) {
        appEventEmitter.emit('message:delivered', {
            messageId: messageId.toString(),
            senderId: message.sender.toString(),
            autoApproved: Boolean(message.autoApproved),
        });
    }
    return 'delivered';
};

/* ------------------------------------------------------------------ */
/*  Admin: approve / reject                                             */
/* ------------------------------------------------------------------ */

const approveMessage = async (id: string, reviewerId?: string) => {
    const claimed = await claimMessageForDelivery(id, reviewerId);
    if (!claimed) {
        const current = await Message.findOne({ _id: id, isDeleted: false }).select('status deliveryStatus');
        if (!current) throw new AppError(StatusCodes.NOT_FOUND, 'Message not found');
        throw new AppError(
            StatusCodes.CONFLICT,
            current.status === 'rejected'
                ? 'This message was already rejected'
                : current.status === 'delivered'
                  ? 'This message was already approved and delivered'
                  : 'This message is already being delivered'
        );
    }
    await deliverClaimedMessage(claimed);
};

const rejectMessage = async (id: string, reason: string, reviewerId?: string) => {
    const now = new Date();
    // Pending messages, or approved ones whose delivery failed, can be rejected.
    const rejected = await Message.findOneAndUpdate(
        {
            _id: id,
            isDeleted: false,
            $or: [{ status: 'pending' }, { status: 'approved', deliveryStatus: 'failed' }],
        },
        {
            $set: {
                status: 'rejected',
                rejectionReason: reason,
                reviewedAt: now,
                ...(reviewerId && Types.ObjectId.isValid(reviewerId)
                    ? { reviewedBy: new Types.ObjectId(reviewerId) }
                    : {}),
            },
        },
        { new: true }
    ).select('_id sender packagePurchaseId');

    if (!rejected) {
        const current = await Message.findOne({ _id: id, isDeleted: false }).select('status');
        if (!current) throw new AppError(StatusCodes.NOT_FOUND, 'Message not found');
        throw new AppError(StatusCodes.CONFLICT, `A ${current.status} message cannot be rejected`);
    }

    // Give the package credit back so the user can send another message.
    await restorePackageCredit(rejected.packagePurchaseId, rejected._id);

    if (rejected.sender) {
        appEventEmitter.emit('message:rejected', {
            messageId: rejected._id.toString(),
            senderId: rejected.sender.toString(),
            reason,
        });
    }
};

const updateMessageStatusIntoDB = async (
    id: string,
    payload: { status: 'approved' | 'rejected'; rejectionReason?: string },
    reviewer: JwtPayload
) => {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid message ID');
    }
    const reviewerId = reviewer?.profileId ?? reviewer?.id;

    if (payload.status === 'approved') {
        await approveMessage(id, reviewerId);
    } else {
        const reason = payload.rejectionReason?.trim();
        if (!reason) {
            throw new AppError(StatusCodes.BAD_REQUEST, 'A rejection reason is required when rejecting a message');
        }
        await rejectMessage(id, reason, reviewerId);
    }

    return Message.findById(id).populate(ADMIN_POPULATE);
};

/**
 * Called when a sender is blocked: their pending messages must not auto-send after 3 days.
 * Rejects them in bulk and returns their package credits (a fixed number of queries, not one per message).
 */
const rejectPendingMessagesFromSender = async (senderProfileId: Types.ObjectId, reason: string) => {
    const pending = await Message.find({ sender: senderProfileId, status: 'pending', isDeleted: false })
        .select('_id')
        .lean();
    if (!pending.length) return 0;

    const ids = pending.map((message) => message._id);
    const result = await Message.updateMany(
        { _id: { $in: ids }, status: 'pending' },
        { $set: { status: 'rejected', rejectionReason: reason, reviewedAt: new Date() } }
    );
    if (!result.modifiedCount) return 0;
    // Only messages that really ended up rejected (one could have been approved concurrently).
    const rejectedIds = (
        await Message.find({ _id: { $in: ids }, status: 'rejected' }).select('_id').lean()
    ).map((message) => message._id);
    await PackagePurchase.updateMany({ messageId: { $in: rejectedIds } }, [
        { $set: { fulfillmentStatus: { $cond: [{ $eq: ['$status', 'completed'] }, 'pending', 'failed'] } } },
        { $unset: ['messageId', 'messageUsedAt'] },
    ]);
    return result.modifiedCount;
};

/* ------------------------------------------------------------------ */
/*  System: auto-approve messages not reviewed within the window        */
/* ------------------------------------------------------------------ */

const autoApproveOverdueMessages = async () => {
    let processed = 0;
    let delivered = 0;

    // Loop in batches; each claimed message leaves the "pending" set, so this terminates.
    for (let round = 0; round < 20; round += 1) {
        const due = await Message.find({
            status: 'pending',
            isDeleted: false,
            autoApproveAt: { $lte: new Date() },
        })
            .select('_id')
            .sort({ autoApproveAt: 1 })
            .limit(MESSAGE_AUTO_APPROVE_BATCH_SIZE)
            .lean();

        for (const { _id } of due) {
            const claimed = await claimMessageForDelivery(_id.toString());
            if (!claimed) continue; // an admin acted on it in the meantime
            processed += 1;
            if ((await deliverClaimedMessage(claimed)) === 'delivered') delivered += 1;
        }

        if (due.length < MESSAGE_AUTO_APPROVE_BATCH_SIZE) break;
    }

    if (processed > 0) {
        logger.info(`Message auto-approval: ${processed} approved, ${delivered} delivered`);
    }
    return { processed, delivered };
};

/* ------------------------------------------------------------------ */
/*  One-time fix for messages created before the review flow existed    */
/* ------------------------------------------------------------------ */

/**
 * The old flow sent messages instantly and saved them as status 'approved'. Messages created
 * by the review flow always have `autoApproveAt`, so its absence identifies legacy records.
 * Idempotent and index-light; safe to run on every startup.
 */
const migrateLegacyMessages = async () => {
    const legacy = { isDeleted: false, status: 'approved', autoApproveAt: { $exists: false } };

    const [sent, failed] = await Promise.all([
        // Successfully sent by the old flow (it set sentAt only after the provider accepted).
        Message.updateMany(
            { ...legacy, deliveryStatus: 'queued', sentAt: { $exists: true } },
            { $set: { status: 'delivered', deliveryStatus: 'delivered' } }
        ),
        // Old-flow failures: the credit was already returned to the user at the time, so these
        // are closed out as rejected rather than offered for retry (a retry would send for free).
        Message.updateMany(
            { ...legacy, deliveryStatus: 'failed' },
            {
                $set: {
                    status: 'rejected',
                    rejectionReason: 'Delivery failed before the review process was introduced. The package credit was returned.',
                },
            }
        ),
    ]);

    if (sent.modifiedCount || failed.modifiedCount) {
        logger.info(
            `Legacy messages migrated: ${sent.modifiedCount} marked delivered, ${failed.modifiedCount} marked rejected`
        );
    }
};

/* ------------------------------------------------------------------ */
/*  Admin: list / stats / detail                                        */
/* ------------------------------------------------------------------ */

const SORTABLE_FIELDS = ['createdAt', 'submittedAt', 'autoApproveAt', 'approvedAt', 'sentAt', 'status'];

const getAllMessagesFromDB = async (query: Record<string, unknown>) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { isDeleted: false };

    const status = pickEnum(query.status, MESSAGE_APPROVAL_STATUS);
    if (status) filter.status = status;

    const deliveryStatus = pickEnum(query.deliveryStatus, DELIVERY_STATUS);
    if (deliveryStatus) filter.deliveryStatus = deliveryStatus;

    const channel = pickEnum(query.channel, DELIVERY_CHANNELS);
    if (channel) filter.channel = channel;

    if (typeof query.topic === 'string' && Types.ObjectId.isValid(query.topic)) {
        filter.topic = new Types.ObjectId(query.topic);
    }

    if (typeof query.searchTerm === 'string' && query.searchTerm.trim()) {
        const escaped = query.searchTerm.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = { $regex: escaped, $options: 'i' };
        filter.$or = [
            { maskedRecipient: regex },
            { recipientName: regex },
            { recipientEmail: regex },
            { recipientPhone: regex },
            { customNote: regex },
        ];
    }

    const sortBy = pickEnum(query.sortBy, SORTABLE_FIELDS) ?? 'createdAt';
    const sortOrder = String(query.sortOrder).toLowerCase() === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
        Message.find(filter)
            .populate(ADMIN_POPULATE)
            .sort({ [sortBy]: sortOrder, _id: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean(),
        Message.countDocuments(filter),
    ]);

    return {
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        data,
    };
};

/** All dashboard counters in a single aggregation. */
const getMessageStatsFromDB = async () => {
    const rows = await Message.aggregate<{ _id: { status: TMessageApprovalStatus; deliveryStatus: string }; count: number }>([
        { $match: { isDeleted: false } },
        { $group: { _id: { status: '$status', deliveryStatus: '$deliveryStatus' }, count: { $sum: 1 } } },
    ]);

    const stats = { total: 0, pending: 0, approved: 0, delivered: 0, rejected: 0, failed: 0 };
    for (const { _id, count } of rows) {
        stats.total += count;
        if (_id.status in stats) stats[_id.status as keyof typeof stats] += count;
        if (_id.status === 'approved' && _id.deliveryStatus === 'failed') stats.failed += count;
    }
    return stats;
};

const getSingleMessageFromDB = async (id: string, requester: JwtPayload) => {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid message ID');
    }

    const filter: Record<string, unknown> = { _id: id, isDeleted: false };
    if (requester.role === 'user') {
        filter.sender = requester.profileId;
    }

    const message = await Message.findOne(filter).populate(ADMIN_POPULATE);
    if (!message) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Message not found');
    }
    return message;
};

/* ------------------------------------------------------------------ */
/*  Admin: soft-delete a message                                        */
/* ------------------------------------------------------------------ */

const deleteMessageFromDB = async (id: string) => {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid message ID');
    }

    // Pending or in-flight messages must be reviewed first, otherwise the user's credit would be lost.
    const deleted = await Message.findOneAndUpdate(
        {
            _id: id,
            isDeleted: false,
            $nor: [{ status: 'pending' }, { status: 'approved', deliveryStatus: 'queued' }],
        },
        { $set: { isDeleted: true } },
        { new: true }
    );

    if (!deleted) {
        const current = await Message.findOne({ _id: id, isDeleted: false }).select('status');
        if (!current) throw new AppError(StatusCodes.NOT_FOUND, 'Message not found');
        throw new AppError(StatusCodes.CONFLICT, 'Approve or reject this message before deleting it');
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

    const status = pickEnum(query.status, MESSAGE_APPROVAL_STATUS);
    if (status) filter.status = status;

    const [data, total] = await Promise.all([
        Message.find(filter)
            .populate('topic', 'name slug tone icon')
            .populate('articles', 'title slug shortDescription')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
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
    getMessageStatsFromDB,
    getSingleMessageFromDB,
    updateMessageStatusIntoDB,
    autoApproveOverdueMessages,
    migrateLegacyMessages,
    rejectPendingMessagesFromSender,
    deleteMessageFromDB,
    getMyMessagesFromDB,
};

export default MessageServices;
