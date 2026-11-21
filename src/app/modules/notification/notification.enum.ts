/* eslint-disable no-unused-vars */
export enum ENUM_NOTIFICATION_TYPE {
    GENERAL = 'general',
    COMMUNITY = 'community',
    RESOURCE = 'resource',
    TOPIC = 'topic',
    SUPPORT = 'support',
    MODERATION = 'moderation',
}

export const NOTIFICATION_ACTION = {
    VIEW: 'VIEW',
    LIST: 'LIST',
    ACTION: 'ACTION',
} as const;

export const NOTIFICATION_ENTITY = {
    COMMUNITY_POST: 'COMMUNITY_POST',
    COMMUNITY_REPLY: 'COMMUNITY_REPLY',
    RESOURCE: 'RESOURCE',
    TOPIC: 'TOPIC',
    USER: 'USER',
    SUPPORT: 'SUPPORT',
    MESSAGE: 'MESSAGE',
    REPORT: 'REPORT',
} as const;

export type NOTIFICATION_ENTITY_TYPE =
    (typeof NOTIFICATION_ENTITY)[keyof typeof NOTIFICATION_ENTITY];
