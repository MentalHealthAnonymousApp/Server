import { Schema, model } from 'mongoose';
import { LegalInfoDocument, LegalInfoModel } from './legal_info.interface';

const LegalInfoSchema = new Schema<LegalInfoDocument, LegalInfoModel>(
    {
        venueOwner: {
            type: Schema.Types.ObjectId,
            ref: 'VenueOwner',
        },
        organizationName: {
            type: String,
            default: 'Mental Health Anonymous',
            trim: true,
        },
        companyName: {
            type: String,
            default: 'Mental Health Anonymous Inc.',
            trim: true,
        },
        businessType: {
            type: String,
            default: 'Non-Profit Organization',
            trim: true,
        },
        registeredAddress: {
            type: String,
            default: '',
            trim: true,
        },
        contactEmail: {
            type: String,
            default: 'support@mentalhealth.org',
            trim: true,
            lowercase: true,
        },
        contactPhone: {
            type: String,
            default: '',
            trim: true,
        },
        jurisdiction: {
            type: String,
            default: 'United States',
            trim: true,
        },
        officialWebsite: {
            type: String,
            default: 'https://mentalhealth.org',
            trim: true,
        },
        emergencyDisclaimer: {
            type: String,
            default:
                'If you or someone you know is in immediate danger or experiencing a medical emergency, please call 988 or go to the nearest emergency room.',
        },
        privacyPolicyHtml: {
            type: String,
            default: '',
        },
        termsOfServiceHtml: {
            type: String,
            default: '',
        },
        zeroRetentionNotice: {
            type: String,
            default:
                'We operate on a strict zero-retention policy for anonymous recipient phone numbers and email addresses.',
        },
        platformFeePercentage: {
            type: Number,
            default: 0,
        },
        freeCancellationHour: {
            type: Number,
            default: 24,
        },
    },
    { timestamps: true }
);

export const LegalInfo = model<LegalInfoDocument, LegalInfoModel>('LegalInfo', LegalInfoSchema);
export default LegalInfo;
