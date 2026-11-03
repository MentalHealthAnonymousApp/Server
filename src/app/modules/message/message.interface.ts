import { Types, Model, Document } from 'mongoose';
import { ENUM_GENDER } from '../user/user.constant';

export type TDeliveryChannel = 'sms' | 'email';
export type TMessageApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delivered';
export type TDeliveryStatus = 'queued' | 'delivered' | 'failed';

export interface IMessage {
    sender: Types.ObjectId;
    recipientContactHash?: string;
    maskedRecipient: string;
    recipientName?: string;
    recipientEmail: string;
    recipientPhone: string;
    recipientAge: string;
    recipientGender: (typeof ENUM_GENDER)[keyof typeof ENUM_GENDER];
    recipientRelationship?: string;
    channel: TDeliveryChannel;
    topic: Types.ObjectId;
    customNote?: string;
    articles: Types.ObjectId[];
    submittedAt: Date;
    status: TMessageApprovalStatus;
    deliveryStatus: TDeliveryStatus;
    rejectionReason?: string;
    approvedAt?: Date;
    sentAt?: Date;
    isDeleted: boolean;
}

export type MessageDocument = IMessage & Document;

export type MessageModel = Model<MessageDocument>;

