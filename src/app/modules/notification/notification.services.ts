/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-undef */
import { JwtPayload } from 'jsonwebtoken';
import QueryBuilder from '../../builder/QueryBuilder';
import { getIO, isUserOnline } from '../../socket/socket';
import { USER_ROLE } from '../user/user.constant';
import Notification from './notification.model';
import mongoose from 'mongoose';
import { Device } from '../device/device.model';
import sendPushNotification from './helpers/sendPushNotification';
import { ISendNotificationParams } from './notification.interface';

const getAllNotificationFromDB = async (
    query: Record<string, any>,
    user: JwtPayload
) => {
    const receiver =
        user?.role === USER_ROLE.superAdmin ? 'admin' : user?.profileId;

    const notificationQuery = new QueryBuilder(
        Notification.find({ receiver }),
        query
    )
        .search(['title'])
        .filter()
        .sort()
        .paginate()
        .fields();

    const result = await notificationQuery.modelQuery;
    const meta = await notificationQuery.countTotal();

    const unreadCount = await Notification.countDocuments({
        receiver,
        isRead: false,
    });

    return {
        meta: {
            ...meta,
            unreadCount,
        },
        result,
    };
};

const seeNotification = async (user: JwtPayload) => {
    let result;
    const now = new Date();

    if (user?.role === USER_ROLE.superAdmin) {
        result = await Notification.updateMany(
            { receiver: 'admin' },
            { isRead: true, readAt: now, isSeen: true, seenAt: now },
            { runValidators: true }
        );
    }
    if (user?.role !== USER_ROLE.superAdmin) {
        result = await Notification.updateMany(
            { receiver: user?.profileId },
            { isRead: true, readAt: now, isSeen: true, seenAt: now },
            { runValidators: true }
        );
    }

    return result;
};

const seeSingleNotification = async (
    notificationId: string,
    user: JwtPayload
) => {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new Error('Invalid Notification ID');
    }

    const filter: any = {
        _id: new mongoose.Types.ObjectId(notificationId),
    };

    // Security: ensure user can only update their own notification
    if (user?.role === USER_ROLE.superAdmin) {
        filter.receiver = 'admin';
    } else {
        filter.receiver = user?.profileId;
    }

    const now = new Date();
    const result = await Notification.findOneAndUpdate(
        filter,
        { isRead: true, readAt: now, isSeen: true, seenAt: now },
        { new: true, runValidators: true }
    );

    return result;
};

const deleteNotification = async (notificationId: string, user: JwtPayload) => {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new Error('Invalid Notification ID');
    }

    const filter: any = {
        _id: new mongoose.Types.ObjectId(notificationId),
    };

    if (user?.role === USER_ROLE.superAdmin) {
        filter.receiver = 'admin';
    } else {
        filter.receiver = user?.profileId;
    }

    const result = await Notification.findOneAndDelete({
        ...filter,
    });

    return result;
};

const sendNotification = async ({
    receiver,
    title,
    message,
    type,
    entity,
    action = 'VIEW',
    entityId,
    meta = {},
}: ISendNotificationParams) => {
    const notification = await Notification.create({
        receiver,
        title,
        message,
        type,
        data: {
            entity,
            action,
            entityId,
            meta,
        },
    });

    const userId = receiver.toString();
    const io = getIO();
    const online = isUserOnline(userId);

    // 1. REALTIME (socket)
    if (online) {
        io.to(userId).emit('notification', notification);
        return notification;
    }

    // 2. OFFLINE PUSH (NEW SYSTEM)
    const devices = await Device.find({
        userId: new mongoose.Types.ObjectId(userId),
        isActive: true,
    }).select('playerId');

    const playerIds = devices.map((d: any) => d.playerId).filter(Boolean);
    if (playerIds.length > 0) {
        await sendPushNotification({
            playerIds,
            message,
            heading: title,
            data: {
                entity,
                action,
                entityId,
                ...meta,
            },
        });
    }

    return notification;
};

const NotificationService = {
    getAllNotificationFromDB,
    seeNotification,
    sendNotification,
    seeSingleNotification,
    deleteNotification,
};

export default NotificationService;
