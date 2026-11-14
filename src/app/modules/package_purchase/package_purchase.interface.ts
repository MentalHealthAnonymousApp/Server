import { Types, Model, Document } from 'mongoose';

export type TPackageTier = 'basic' | 'standard' | 'premium';
export type TPurchaseStatus =
    | 'pending'
    | 'completed'
    | 'failed'
    | 'canceled'
    | 'refunded'
    | 'partially_refunded'
    | 'disputed';
export type TBillingProvider = 'stripe' | 'apple_app_store' | 'google_play';
export type TPaymentMethod = 'card' | 'apple_pay' | 'google_pay' | 'unknown';
export type TFulfillmentStatus = 'pending' | 'fulfilled' | 'failed';

export interface IPackagePurchase {
    userId?: Types.ObjectId;
    packageTier: TPackageTier;
    productId: string;
    providerPriceId: string;
    amountMinor: number;
    currency: string;
    billingProvider: TBillingProvider;
    paymentMethod?: TPaymentMethod;
    providerTransactionId?: string;
    stripeCheckoutSessionId?: string;
    status: TPurchaseStatus;
    fulfillmentStatus: TFulfillmentStatus;
    messageId?: Types.ObjectId;
    messageUsedAt?: Date;
    paidAt?: Date;
    refundedAt?: Date;
    refundedAmountMinor?: number;
    consultationLink?: string;
    consultationSent: boolean;
    consultationSentAt?: Date;
    consultationNotes?: string;
    isDeleted: boolean;
}

export type PackagePurchaseDocument = IPackagePurchase & Document;
export type PackagePurchaseModel = Model<PackagePurchaseDocument>;
