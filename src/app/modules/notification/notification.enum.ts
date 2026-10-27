/* eslint-disable no-unused-vars */
export enum ENUM_NOTIFICATION_TYPE {
    GENERAL = 'general',
    SUPPORT_CREATED = 'SUPPORT_CREATED',
}
export const NOTIFICATION_ACTION = {
    VIEW: 'VIEW',
    LIST: 'LIST',
    ACTION: 'ACTION',
};

export const NOTIFICATION_ENTITY = {
    ORDER: 'ORDER',
    SHIFT: 'SHIFT',
    PAYMENT: 'PAYMENT',
    USER: 'USER',
    CAMPAIGN: 'CAMPAIGN',
    REVIEW: 'REVIEW',
    JOB: 'JOB',
    SUPPORT: 'SUPPORT',
} as const;

export type NOTIFICATION_ENTITY_TYPE =
    (typeof NOTIFICATION_ENTITY)[keyof typeof NOTIFICATION_ENTITY];
