import { Types, Model, Document } from 'mongoose';

export type TPackageTier = 'basic' | 'standard' | 'premium';
export type TPurchaseStatus = 'completed' | 'pending' | 'refunded';
export type TPaymentMethod = 'stripe' | 'apple_pay' | 'google_pay' | 'credit_card';

export interface IPackagePurchase {
    userId?: Types.ObjectId;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    packageTier: TPackageTier;
    packageName: string;
    amount: number;
    currency: string;
    paymentMethod: TPaymentMethod;
    transactionId: string;
    status: TPurchaseStatus;
    consultationLink?: string;
    consultationSent: boolean;
    consultationSentAt?: Date;
    consultationNotes?: string;
    recipientContact?: string;
    topicName?: string;
    isDeleted: boolean;
}

export type PackagePurchaseDocument = IPackagePurchase & Document;
export type PackagePurchaseModel = Model<PackagePurchaseDocument>;

