import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import { appEventEmitter } from '../../events/eventEmitter';
import Message from '../message/message.model';
import NormalUser from '../normal_user/normal_user.model';
import NormalUserServices from '../normal_user/normal_user.service';
import { DELIVERY_CHANNELS } from '../message/message.constant';
import Report from './report.model';
import { REPORT_REASONS, REPORT_STATUS } from './report.constant';
import { TReportReasonCategory } from './report.interface';

const REPORT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

const pickEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Resolves a recipient's report link to the delivered message it belongs to. */
const findMessageByReportToken = async (token: string) => {
    if (!REPORT_TOKEN_PATTERN.test(token)) return null;
    return Message.findOne({ reportToken: token, isDeleted: false, status: 'delivered' })
        .select('_id sender channel recipientEmail recipientPhone maskedRecipient sentAt topic')
        .populate<{ topic: { name?: string; tone?: string } | null }>('topic', 'name tone');
};

const INVALID_LINK = 'This report link is invalid or has expired. If you need help, please contact our support team.';

/* ------------------------------------------------------------------ */
/*  Public (message recipient, no account)                              */
/* ------------------------------------------------------------------ */

/** Minimal context for the report page. Never reveals who the sender is. */
const getReportContext = async (token: string) => {
    const message = await findMessageByReportToken(token);
    if (!message) throw new AppError(StatusCodes.NOT_FOUND, INVALID_LINK);

    const alreadyReported = Boolean(await Report.exists({ messageId: message._id }));
    return {
        topicName: message.topic?.name ?? 'Mental health support',
        channel: message.channel,
        sentAt: message.sentAt,
        alreadyReported,
    };
};

const submitReport = async (payload: {
    ref: string;
    reasonCategory: TReportReasonCategory;
    reasonText?: string;
}) => {
    const message = await findMessageByReportToken(payload.ref);
    if (!message) throw new AppError(StatusCodes.NOT_FOUND, INVALID_LINK);

    if (await Report.exists({ messageId: message._id })) {
        throw new AppError(StatusCodes.CONFLICT, 'This message has already been reported. Our team is reviewing it.');
    }

    const sender = message.sender
        ? await NormalUser.findById(message.sender).select('fullName firstName lastName email phone').lean()
        : null;
    const senderName =
        sender?.fullName || [sender?.firstName, sender?.lastName].filter(Boolean).join(' ') || 'Unknown sender';

    let report;
    try {
        report = await Report.create({
            messageId: message._id,
            reportedUserId: message.sender,
            reportedPersonName: senderName,
            reportedPersonContact: sender?.email || sender?.phone || 'Not available',
            reportedByContact:
                (message.channel === 'email' ? message.recipientEmail : message.recipientPhone) ||
                message.maskedRecipient,
            reportedByChannel: message.channel,
            topicTitle: message.topic?.name ?? 'Unknown topic',
            tone: message.topic?.tone,
            reasonCategory: payload.reasonCategory,
            reasonText: payload.reasonText?.trim() || 'No additional details were provided.',
            status: 'new',
        });
    } catch (error) {
        // Two submissions racing past the exists() check: the unique index catches the second one.
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            throw new AppError(StatusCodes.CONFLICT, 'This message has already been reported. Our team is reviewing it.');
        }
        throw error;
    }

    appEventEmitter.emit('report:created', {
        reportId: report._id.toString(),
        reasonCategory: payload.reasonCategory,
    });

    return { reportId: report._id.toString() };
};

/* ------------------------------------------------------------------ */
/*  Admin                                                               */
/* ------------------------------------------------------------------ */

const getAdminReports = async (query: Record<string, unknown>) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

    const filter: Record<string, unknown> = { isDeleted: false };
    const status = pickEnum(query.status, REPORT_STATUS);
    if (status) filter.status = status;
    const reasonCategory = pickEnum(query.reasonCategory, REPORT_REASONS);
    if (reasonCategory) filter.reasonCategory = reasonCategory;
    const channel = pickEnum(query.channel, DELIVERY_CHANNELS);
    if (channel) filter.reportedByChannel = channel;
    if (typeof query.reportedUserId === 'string' && Types.ObjectId.isValid(query.reportedUserId)) {
        filter.reportedUserId = new Types.ObjectId(query.reportedUserId);
    }

    if (typeof query.searchTerm === 'string' && query.searchTerm.trim()) {
        const regex = new RegExp(escapeRegex(query.searchTerm.trim().slice(0, 100)), 'i');
        filter.$or = [
            { reportedPersonName: regex },
            { reportedPersonContact: regex },
            { reasonText: regex },
            { topicTitle: regex },
        ];
    }

    const [data, total] = await Promise.all([
        Report.find(filter)
            .populate('reportedUserId', 'firstName lastName email isBlocked status')
            .populate('messageId', 'customNote channel sentAt status')
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Report.countDocuments(filter),
    ]);

    return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
};

const getAdminReportStats = async () => {
    const [rows, blockedSenders] = await Promise.all([
        Report.aggregate<{ _id: string; count: number }>([
            { $match: { isDeleted: false } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        NormalUser.countDocuments({ isBlocked: true, isDeleted: { $ne: true } }),
    ]);
    const byStatus = Object.fromEntries(rows.map((row) => [row._id, row.count]));
    const open = byStatus.new ?? 0;
    const resolved = byStatus.resolved ?? 0;
    return { total: open + resolved, new: open, resolved, blockedSenders };
};

const resolveReport = async (id: string, resolutionNotes: string | undefined, adminProfileId?: string) => {
    if (!Types.ObjectId.isValid(id)) throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid report ID');

    const report = await Report.findOneAndUpdate(
        { _id: id, isDeleted: false, status: 'new' },
        {
            $set: {
                status: 'resolved',
                resolvedAt: new Date(),
                ...(resolutionNotes?.trim() ? { resolutionNotes: resolutionNotes.trim() } : {}),
                ...(adminProfileId && Types.ObjectId.isValid(adminProfileId)
                    ? { resolvedBy: new Types.ObjectId(adminProfileId) }
                    : {}),
            },
        },
        { new: true }
    );
    if (!report) {
        const exists = await Report.exists({ _id: id, isDeleted: false });
        throw new AppError(
            exists ? StatusCodes.CONFLICT : StatusCodes.NOT_FOUND,
            exists ? 'This report is already resolved' : 'Report not found'
        );
    }
    return report;
};

/**
 * Blocks the sender a report is about, rejects their pending messages, and resolves every
 * open report against them (they all lead to the same outcome).
 */
const blockReportedSender = async (id: string, reason: string | undefined, adminProfileId?: string) => {
    if (!Types.ObjectId.isValid(id)) throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid report ID');

    const report = await Report.findOne({ _id: id, isDeleted: false }).select('reportedUserId');
    if (!report) throw new AppError(StatusCodes.NOT_FOUND, 'Report not found');
    if (!report.reportedUserId) {
        throw new AppError(StatusCodes.UNPROCESSABLE_ENTITY, 'This report is not linked to a registered sender');
    }

    const blockReason = reason?.trim() || 'Blocked following a recipient report';
    const { rejectedPendingMessages } = await NormalUserServices.setUserBlocked(
        report.reportedUserId.toString(),
        true,
        blockReason
    );

    const resolved = await Report.updateMany(
        { reportedUserId: report.reportedUserId, status: 'new', isDeleted: false },
        {
            $set: {
                status: 'resolved',
                resolvedAt: new Date(),
                resolutionNotes: `Sender blocked: ${blockReason}`,
                ...(adminProfileId && Types.ObjectId.isValid(adminProfileId)
                    ? { resolvedBy: new Types.ObjectId(adminProfileId) }
                    : {}),
            },
        }
    );

    return { rejectedPendingMessages, resolvedReports: resolved.modifiedCount };
};

const ReportServices = {
    getReportContext,
    submitReport,
    getAdminReports,
    getAdminReportStats,
    resolveReport,
    blockReportedSender,
};

export default ReportServices;
