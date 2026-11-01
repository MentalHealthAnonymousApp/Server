import { appEventEmitter } from '../eventEmitter';
import NotificationService from '../../modules/notification/notification.services';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ENTITY,
    NOTIFICATION_ACTION,
} from '../../modules/notification/notification.enum';

// community:post:submitted → admin gets notified of new pending post
appEventEmitter.on(
    'community:post:submitted',
    (payload: { postId: string; authorId: string; title: string }) => {
        NotificationService.sendNotification({
            receiver: 'admin',
            title: 'New Community Post Pending Review',
            message: `A new post '${payload.title}' has been submitted for review.`,
            type: ENUM_NOTIFICATION_TYPE.COMMUNITY,
            entity: NOTIFICATION_ENTITY.COMMUNITY_POST,
            action: NOTIFICATION_ACTION.ACTION,
            entityId: payload.postId,
        }).catch(console.error);
    }
);

// community:post:approved → notify post author
appEventEmitter.on(
    'community:post:approved',
    (payload: { postId: string; authorId: string; title: string }) => {
        NotificationService.sendNotification({
            receiver: payload.authorId,
            title: 'Your Post Was Approved 🎉',
            message: `Your community post '${payload.title}' has been approved and is now live.`,
            type: ENUM_NOTIFICATION_TYPE.MODERATION,
            entity: NOTIFICATION_ENTITY.COMMUNITY_POST,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: payload.postId,
        }).catch(console.error);
    }
);

// community:post:rejected → notify post author
appEventEmitter.on(
    'community:post:rejected',
    (payload: { postId: string; authorId: string; title: string; reason: string }) => {
        NotificationService.sendNotification({
            receiver: payload.authorId,
            title: 'Your Post Was Not Approved',
            message: `Your community post '${payload.title}' was rejected. Reason: ${payload.reason}`,
            type: ENUM_NOTIFICATION_TYPE.MODERATION,
            entity: NOTIFICATION_ENTITY.COMMUNITY_POST,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: payload.postId,
        }).catch(console.error);
    }
);

// community:post:needs_update → notify post author
appEventEmitter.on(
    'community:post:needs_update',
    (payload: { postId: string; authorId: string; title: string; feedback: string }) => {
        NotificationService.sendNotification({
            receiver: payload.authorId,
            title: 'Your Post Needs Some Updates',
            message: `Please update your community post '${payload.title}'. Feedback: ${payload.feedback}`,
            type: ENUM_NOTIFICATION_TYPE.MODERATION,
            entity: NOTIFICATION_ENTITY.COMMUNITY_POST,
            action: NOTIFICATION_ACTION.ACTION,
            entityId: payload.postId,
        }).catch(console.error);
    }
);

// community:post:liked → notify post author
appEventEmitter.on(
    'community:post:liked',
    (payload: { postId: string; authorId: string; likerName: string }) => {
        NotificationService.sendNotification({
            receiver: payload.authorId,
            title: 'Someone Liked Your Post ❤️',
            message: `${payload.likerName} liked your community post.`,
            type: ENUM_NOTIFICATION_TYPE.COMMUNITY,
            entity: NOTIFICATION_ENTITY.COMMUNITY_POST,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: payload.postId,
        }).catch(console.error);
    }
);

// community:reply:created → notify post author
appEventEmitter.on(
    'community:reply:created',
    (payload: { postId: string; postAuthorId: string; replierName: string; postTitle: string }) => {
        NotificationService.sendNotification({
            receiver: payload.postAuthorId,
            title: 'New Reply on Your Post 💬',
            message: `${payload.replierName} replied to your post '${payload.postTitle}'.`,
            type: ENUM_NOTIFICATION_TYPE.COMMUNITY,
            entity: NOTIFICATION_ENTITY.COMMUNITY_REPLY,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: payload.postId,
        }).catch(console.error);
    }
);

// resource:published → notify admin
appEventEmitter.on(
    'resource:published',
    (payload: { resourceId: string; title: string }) => {
        NotificationService.sendNotification({
            receiver: 'admin',
            title: 'New Resource Published',
            message: `A new resource '${payload.title}' has been published.`,
            type: ENUM_NOTIFICATION_TYPE.RESOURCE,
            entity: NOTIFICATION_ENTITY.RESOURCE,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: payload.resourceId,
        }).catch(console.error);
    }
);

// topic:created → notify admin
appEventEmitter.on(
    'topic:created',
    (payload: { topicId: string; name: string }) => {
        NotificationService.sendNotification({
            receiver: 'admin',
            title: 'New Topic Created',
            message: `A new topic '${payload.name}' has been created.`,
            type: ENUM_NOTIFICATION_TYPE.TOPIC,
            entity: NOTIFICATION_ENTITY.TOPIC,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: payload.topicId,
        }).catch(console.error);
    }
);

// topic:updated → notify admin
appEventEmitter.on(
    'topic:updated',
    (payload: { topicId: string; name: string }) => {
        NotificationService.sendNotification({
            receiver: 'admin',
            title: 'Topic Updated',
            message: `The topic '${payload.name}' has been updated.`,
            type: ENUM_NOTIFICATION_TYPE.TOPIC,
            entity: NOTIFICATION_ENTITY.TOPIC,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: payload.topicId,
        }).catch(console.error);
    }
);
