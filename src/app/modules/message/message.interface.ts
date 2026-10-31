import { Types, Model, Document } from 'mongoose';
import { TTopicTone } from '../topic/topic.interface';

export type TDeliveryChannel = 'sms' | 'email';
export type TMessageApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delivered';
export type TDeliveryStatus = 'queued' | 'delivered' | 'failed';

export interface IMessage {
    senderId?: Types.ObjectId;
    senderName?: string;
    senderEmail?: string;
    senderPhone?: string;
    recipientContactHash?: string;
    maskedRecipient: string;
    recipientName?: string;
    recipientRelationship?: string;
    channel: TDeliveryChannel;
    topicId: Types.ObjectId;
    topicTitle: string;
    tone: TTopicTone;
    customNote?: string;
    articles: Types.ObjectId[];
    submittedAt: Date;
    scheduledFor?: Date;
    status: TMessageApprovalStatus;
    deliveryStatus: TDeliveryStatus;
    rejectionReason?: string;
    approvedAt?: Date;
    approvedBy?: Types.ObjectId;
    sentAt?: Date;
    isDeleted: boolean;
}

export type MessageDocument = IMessage & Document;

export type MessageModel = Model<MessageDocument>;

