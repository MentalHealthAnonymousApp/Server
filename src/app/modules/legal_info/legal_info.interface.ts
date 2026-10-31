import { Types, Model, Document } from 'mongoose';

export interface ILegalInfo {
    venueOwner?: Types.ObjectId;
    organizationName?: string;
    companyName?: string;
    businessType?: string;
    registeredAddress?: string;
    contactEmail?: string;
    contactPhone?: string;
    jurisdiction?: string;
    officialWebsite?: string;
    emergencyDisclaimer?: string;
    privacyPolicyHtml?: string;
    termsOfServiceHtml?: string;
    zeroRetentionNotice?: string;
    platformFeePercentage?: number;
    freeCancellationHour?: number;
}

export type LegalInfoDocument = ILegalInfo & Document;
export type LegalInfoModel = Model<LegalInfoDocument>;
