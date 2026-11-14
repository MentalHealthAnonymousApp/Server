import { Schema, model } from 'mongoose';
import { MessageDocument, MessageModel } from './message.interface';
import { DELIVERY_CHANNELS, DELIVERY_STATUS, MESSAGE_APPROVAL_STATUS } from './message.constant';
import { ENUM_GENDER } from '../user/user.constant';

const messageSchema = new Schema<MessageDocument, MessageModel>(
    {
        sender: {
            type: Schema.Types.ObjectId,
            ref: 'NormalUser',
            index: true,
        },
        packagePurchaseId: {
            type: Schema.Types.ObjectId,
            ref: 'PackagePurchase',
            required: true,
            index: true,
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
        idempotencyKey: {
            type: String,
            trim: true,
        },
        idempotencyHash: {
            type: String,
            select: false,
        },
        attestedAt: {
            type: Date,
        },
        recipientEmail: {
            type: String,
            trim: true,
            lowercase: true,
        },
        recipientPhone: {
            type: String,
            trim: true,
        },
        recipientAge: {
            type: String,
            trim: true,
        },
        recipientGender: {
            type: String,
            enum: Object.values(ENUM_GENDER),
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
        topic: {
            type: Schema.Types.ObjectId,
            ref: 'Topic',
            required: true,
            index: true,
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
        status: {
            type: String,
            enum: MESSAGE_APPROVAL_STATUS,
            default: 'pending',
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
        sentAt: {
            type: Date,
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

messageSchema.index(
    { sender: 1, idempotencyKey: 1 },
    {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
    }
);

export const Message = model<MessageDocument, MessageModel>('Message', messageSchema);
export default Message;
