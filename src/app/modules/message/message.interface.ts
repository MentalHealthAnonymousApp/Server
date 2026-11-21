import { Types, Model, Document } from 'mongoose';
export type TDeliveryChannel = 'sms' | 'email';
export type TMessageApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delivered';
export type TDeliveryStatus = 'queued' | 'delivered' | 'failed';

export interface IMessage {
    sender: Types.ObjectId;
    packagePurchaseId: Types.ObjectId;
    recipientContactHash?: string;
    maskedRecipient: string;
    recipientName?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    recipientAge?: string;
    recipientGender?: string;
    recipientRelationship?: string;
    idempotencyKey?: string;
    reportToken?: string;
    idempotencyHash?: string;
    attestedAt?: Date;
    channel: TDeliveryChannel;
    topic: Types.ObjectId;
    customNote?: string;
    articles: Types.ObjectId[];
    submittedAt: Date;
    status: TMessageApprovalStatus;
    deliveryStatus: TDeliveryStatus;
    rejectionReason?: string;
    approvedAt?: Date;
    autoApproveAt?: Date;
    autoApproved?: boolean;
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date;
    deliveryError?: string;
    sentAt?: Date;
    isDeleted: boolean;
}

export type MessageDocument = IMessage & Document;

export type MessageModel = Model<MessageDocument>;
