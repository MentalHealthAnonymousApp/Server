import { Schema, model } from 'mongoose';
import {
    PackagePurchaseDocument,
    PackagePurchaseModel,
} from './package_purchase.interface';
import {
    BILLING_PROVIDERS,
    FULFILLMENT_STATUSES,
    PACKAGE_TIERS,
    PAYMENT_METHODS,
    PURCHASE_STATUS,
} from './package_purchase.constant';

const packagePurchaseSchema = new Schema<PackagePurchaseDocument, PackagePurchaseModel>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'NormalUser',
            index: true,
        },
        packageTier: {
            type: String,
            enum: PACKAGE_TIERS,
            required: true,
            index: true,
        },
        productId: {
            type: String,
            required: true,
            trim: true,
        },
        providerPriceId: {
            type: String,
            required: true,
            trim: true,
        },
        amountMinor: {
            type: Number,
            required: true,
            min: 0,
            validate: {
                validator: Number.isSafeInteger,
                message: 'amountMinor must be a safe integer in the currency’s minor unit.',
            },
        },
        currency: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            match: /^[A-Z]{3}$/,
        },
        billingProvider: {
            type: String,
            enum: BILLING_PROVIDERS,
            required: true,
            index: true,
        },
        paymentMethod: {
            type: String,
            enum: PAYMENT_METHODS,
        },
        providerTransactionId: {
            type: String,
            trim: true,
        },
        stripeCheckoutSessionId: {
            type: String,
            trim: true,
            sparse: true,
            unique: true,
        },
        status: {
            type: String,
            enum: PURCHASE_STATUS,
            required: true,
            default: 'pending',
            index: true,
        },
        fulfillmentStatus: {
            type: String,
            enum: FULFILLMENT_STATUSES,
            required: true,
            default: 'pending',
            index: true,
        },
        messageId: {
            type: Schema.Types.ObjectId,
            ref: 'Message',
        },
        messageUsedAt: {
            type: Date,
        },
        paidAt: {
            type: Date,
        },
        refundedAt: {
            type: Date,
        },
        refundedAmountMinor: {
            type: Number,
            min: 0,
            validate: {
                validator: (value: number | undefined) =>
                    value === undefined || Number.isSafeInteger(value),
                message: 'refundedAmountMinor must be a safe integer in the currency’s minor unit.',
            },
        },
        consultationLink: {
            type: String,
            trim: true,
        },
        consultationSent: {
            type: Boolean,
            required: true,
            default: false,
        },
        consultationSentAt: {
            type: Date,
        },
        consultationNotes: {
            type: String,
            trim: true,
        },
        isDeleted: {
            type: Boolean,
            required: true,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

packagePurchaseSchema.index(
    { billingProvider: 1, providerTransactionId: 1 },
    {
        unique: true,
        partialFilterExpression: { providerTransactionId: { $type: 'string' } },
    }
);

export const PackagePurchase = model<PackagePurchaseDocument, PackagePurchaseModel>(
    'PackagePurchase',
    packagePurchaseSchema
);
export default PackagePurchase;
