import { Schema, model } from 'mongoose';
import { MessageDocument, MessageModel } from './message.interface';
import { DELIVERY_CHANNELS, DELIVERY_STATUS, MESSAGE_APPROVAL_STATUS } from './message.constant';
import { TOPIC_TONES } from '../topic/topic.constant';

const messageSchema = new Schema<MessageDocument, MessageModel>(
    {
        senderId: {
            type: Schema.Types.ObjectId,
            ref: 'NormalUser',
            index: true,
        },
        senderName: {
            type: String,
            default: 'Anonymous Sender',
        },
        senderEmail: {
            type: String,
            trim: true,
            lowercase: true,
        },
        senderPhone: {
            type: String,
            trim: true,
        },
        recipientContactHash: {
            type: String,
            index: true,
        },
        maskedRecipient: {
            type: String,
            required: true,
            trim: true,
        },
        recipientName: {
            type: String,
            trim: true,
        },
        recipientRelationship: {
            type: String,
            trim: true,
        },
        channel: {
            type: String,
            enum: DELIVERY_CHANNELS,
            required: true,
            index: true,
        },
        topicId: {
            type: Schema.Types.ObjectId,
            ref: 'Topic',
            required: true,
            index: true,
        },
        topicTitle: {
            type: String,
            required: true,
        },
        tone: {
            type: String,
            enum: TOPIC_TONES,
            default: 'sky',
        },
        customNote: {
            type: String,
            trim: true,
        },
        articles: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Resource',
            },
        ],
        submittedAt: {
            type: Date,
            default: Date.now,
        },
        scheduledFor: {
            type: Date,
        },
        status: {
            type: String,
            enum: MESSAGE_APPROVAL_STATUS,
            default: 'approved',
            index: true,
        },
        deliveryStatus: {
            type: String,
            enum: DELIVERY_STATUS,
            default: 'queued',
            index: true,
        },
        rejectionReason: {
            type: String,
        },
        approvedAt: {
            type: Date,
        },
        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        sentAt: {
            type: Date,
            default: Date.now,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

export const Message = model<MessageDocument, MessageModel>('Message', messageSchema);
export default Message;

