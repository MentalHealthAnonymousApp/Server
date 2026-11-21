import { appEventEmitter } from '../eventEmitter';
import NotificationService from '../../modules/notification/notification.services';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import { errorLogger } from '../../shared/logger';

const logFailure = (event: string) => (error: unknown) =>
    errorLogger.error(`Notification for ${event} failed`, error);

// message:submitted → admins get a review request
appEventEmitter.on('message:submitted', (payload: { messageId: string; topicName: string }) => {
    NotificationService.sendNotification({
        receiver: 'admin',
        title: 'New Message Pending Review',
        message: `A new '${payload.topicName}' message is waiting for approval. It will be sent automatically in 3 days if not reviewed.`,
        type: ENUM_NOTIFICATION_TYPE.MODERATION,
        entity: NOTIFICATION_ENTITY.MESSAGE,
        action: NOTIFICATION_ACTION.ACTION,
        entityId: payload.messageId,
    }).catch(logFailure('message:submitted'));
});

// message:delivered → sender learns their message went out
appEventEmitter.on('message:delivered', (payload: { messageId: string; senderId: string }) => {
    NotificationService.sendNotification({
        receiver: payload.senderId,
        title: 'Your Message Was Sent',
        message: 'Your message was approved and delivered to the recipient.',
        type: ENUM_NOTIFICATION_TYPE.MODERATION,
        entity: NOTIFICATION_ENTITY.MESSAGE,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.messageId,
    }).catch(logFailure('message:delivered'));
});

// message:rejected → sender learns why, and that their credit is back
appEventEmitter.on(
    'message:rejected',
    (payload: { messageId: string; senderId: string; reason: string }) => {
        NotificationService.sendNotification({
            receiver: payload.senderId,
            title: 'Your Message Was Not Approved',
            message: `Your message was not sent. Reason: ${payload.reason} Your package credit has been returned so you can send a new message.`,
            type: ENUM_NOTIFICATION_TYPE.MODERATION,
            entity: NOTIFICATION_ENTITY.MESSAGE,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: payload.messageId,
        }).catch(logFailure('message:rejected'));
    }
);

// report:created → admins see a new recipient report
const REPORT_REASON_LABELS: Record<string, string> = {
    harassment: 'harassment',
    unsolicited: 'unsolicited contact',
    distressing: 'distressing content',
    wrong_number: 'wrong recipient',
    spam: 'spam',
    other: 'another concern',
};

appEventEmitter.on('report:created', (payload: { reportId: string; reasonCategory: string }) => {
    NotificationService.sendNotification({
        receiver: 'admin',
        title: 'New Message Report',
        message: `A recipient reported a message for ${REPORT_REASON_LABELS[payload.reasonCategory] ?? 'a concern'}.`,
        type: ENUM_NOTIFICATION_TYPE.MODERATION,
        entity: NOTIFICATION_ENTITY.REPORT,
        action: NOTIFICATION_ACTION.ACTION,
        entityId: payload.reportId,
    }).catch(logFailure('report:created'));
});
