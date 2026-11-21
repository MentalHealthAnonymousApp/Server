import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import NormalUser from './normal_user.model';
import User from '../user/user.model';
import Message from '../message/message.model';
import Report from '../report/report.model';
import MessageServices from '../message/message.service';

const getSingleNormalUserProfile = async (profileId: string) => {
  if (!Types.ObjectId.isValid(profileId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid user ID');
  }
  return NormalUser.findOne({ _id: new Types.ObjectId(profileId), isDeleted: { $ne: true } }).populate({
    path: 'user',
    select: '-password -verifyEmailOTP -verifyEmailOTPExpire -isResetOTPVerified -__v',
  });
};

/* ------------------------------------------------------------------ */
/*  Admin: list / stats                                                 */
/* ------------------------------------------------------------------ */

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAdminUsers = async (query: Record<string, unknown>) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

  const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
  if (query.status === 'blocked') filter.isBlocked = true;
  if (query.status === 'active') filter.isBlocked = { $ne: true };

  if (typeof query.searchTerm === 'string' && query.searchTerm.trim()) {
    const regex = new RegExp(escapeRegex(query.searchTerm.trim().slice(0, 100)), 'i');
    filter.$or = [{ fullName: regex }, { firstName: regex }, { lastName: regex }, { email: regex }, { phone: regex }];
  }

  const [users, total] = await Promise.all([
    NormalUser.find(filter)
      .select('firstName lastName fullName email phone profile_image status isBlocked blockedAt blockedReason notes lastActiveAt createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    NormalUser.countDocuments(filter),
  ]);

  // Per-row counts for just this page: two grouped queries instead of one per user.
  const ids = users.map((user) => user._id);
  const [messageCounts, reportCounts] = ids.length
    ? await Promise.all([
        Message.aggregate<{ _id: Types.ObjectId; sent: number; pending: number }>([
          { $match: { sender: { $in: ids }, isDeleted: false } },
          {
            $group: {
              _id: '$sender',
              sent: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
              pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            },
          },
        ]),
        Report.aggregate<{ _id: Types.ObjectId; total: number; open: number }>([
          { $match: { reportedUserId: { $in: ids }, isDeleted: false } },
          {
            $group: {
              _id: '$reportedUserId',
              total: { $sum: 1 },
              open: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } },
            },
          },
        ]),
      ])
    : [[], []];

  const messagesBy = new Map(messageCounts.map((row) => [row._id.toString(), row]));
  const reportsBy = new Map(reportCounts.map((row) => [row._id.toString(), row]));

  const data = users.map((user) => {
    const key = user._id.toString();
    return {
      ...user,
      messagesSentCount: messagesBy.get(key)?.sent ?? 0,
      pendingMessagesCount: messagesBy.get(key)?.pending ?? 0,
      reportsReceivedCount: reportsBy.get(key)?.total ?? 0,
      openReportsCount: reportsBy.get(key)?.open ?? 0,
    };
  });

  return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
};

const getAdminUserStats = async () => {
  const [[counts], messagesDelivered] = await Promise.all([
    NormalUser.aggregate<{ total: number; blocked: number; newThisMonth: number }>([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          blocked: { $sum: { $cond: [{ $eq: ['$isBlocked', true] }, 1, 0] } },
          newThisMonth: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] }, 1, 0],
            },
          },
        },
      },
    ]),
    Message.countDocuments({ status: 'delivered', isDeleted: false }),
  ]);

  const total = counts?.total ?? 0;
  const blocked = counts?.blocked ?? 0;
  return { total, active: total - blocked, blocked, newThisMonth: counts?.newThisMonth ?? 0, messagesDelivered };
};

/* ------------------------------------------------------------------ */
/*  Admin: block / unblock / delete                                     */
/* ------------------------------------------------------------------ */

/**
 * Blocks or unblocks a user. Keeps the profile (shown on the dashboard) and the auth account
 * (checked at sign-in and on every request) in sync. Blocking also rejects their pending
 * messages so nothing they queued auto-sends after the 3-day review window.
 */
const setUserBlocked = async (profileId: string, blocked: boolean, reason?: string) => {
  if (!Types.ObjectId.isValid(profileId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid user ID');
  }

  const profile = await NormalUser.findOneAndUpdate(
    { _id: profileId, isDeleted: { $ne: true } },
    blocked
      ? {
          $set: {
            isBlocked: true,
            status: 'blocked',
            blockedAt: new Date(),
            blockedReason: reason?.trim() || 'Blocked by an administrator',
          },
        }
      : { $set: { isBlocked: false, status: 'active' }, $unset: { blockedAt: 1, blockedReason: 1 } },
    { new: true }
  ).select('user firstName lastName fullName email isBlocked status blockedAt blockedReason');
  if (!profile) throw new AppError(StatusCodes.NOT_FOUND, 'User not found');

  await User.updateOne({ _id: profile.user }, { $set: { isBlocked: blocked } });

  const rejectedPendingMessages = blocked
    ? await MessageServices.rejectPendingMessagesFromSender(
        profile._id as Types.ObjectId,
        'The sender account was blocked by an administrator.'
      )
    : 0;

  return { user: profile, rejectedPendingMessages };
};

/** Soft delete: the account can no longer sign in, and history (reports, purchases) is kept. */
const deleteUserByAdmin = async (profileId: string) => {
  if (!Types.ObjectId.isValid(profileId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid user ID');
  }
  const profile = await NormalUser.findOneAndUpdate(
    { _id: profileId, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  ).select('user');
  if (!profile) throw new AppError(StatusCodes.NOT_FOUND, 'User not found');

  await Promise.all([
    User.updateOne({ _id: profile.user }, { $set: { isDeleted: true } }),
    MessageServices.rejectPendingMessagesFromSender(
      profile._id as Types.ObjectId,
      'The sender account was deleted.'
    ),
  ]);
  return null;
};

const NormalUserServices = {
  getSingleNormalUserProfile,
  getAdminUsers,
  getAdminUserStats,
  setUserBlocked,
  deleteUserByAdmin,
};

export default NormalUserServices;
