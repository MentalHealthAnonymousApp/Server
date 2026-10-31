import { Schema, model } from 'mongoose';
import { PackagePurchaseDocument, PackagePurchaseModel } from './package_purchase.interface';
import { PACKAGE_TIERS, PAYMENT_METHODS, PURCHASE_STATUS } from './package_purchase.constant';

const packagePurchaseSchema = new Schema<PackagePurchaseDocument, PackagePurchaseModel>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'NormalUser',
            index: true,
        },
        customerName: {
            type: String,
            required: true,
            trim: true,
        },
        customerEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        customerPhone: {
            type: String,
            trim: true,
        },
        packageTier: {
            type: String,
            enum: PACKAGE_TIERS,
            required: true,
            index: true,
        },
        packageName: {
            type: String,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: 'USD',
        },
        paymentMethod: {
            type: String,
            enum: PAYMENT_METHODS,
            default: 'stripe',
        },
        transactionId: {
            type: String,
            required: true,
            unique: true,
        },
        status: {
            type: String,
            enum: PURCHASE_STATUS,
            default: 'completed',
            index: true,
        },
        consultationLink: {
            type: String,
            trim: true,
        },
        consultationSent: {
            type: Boolean,
            default: false,
        },
        consultationSentAt: {
            type: Date,
        },
        consultationNotes: {
            type: String,
        },
        recipientContact: {
            type: String,
        },
        topicName: {
            type: String,
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

export const PackagePurchase = model<PackagePurchaseDocument, PackagePurchaseModel>(
    'PackagePurchase',
    packagePurchaseSchema
);
export default PackagePurchase;

