import { z } from 'zod';
import { PACKAGE_TIERS } from './package_purchase.constant';

const createCheckoutSessionValidationSchema = z.object({
    body: z.object({
        packageTier: z.enum(PACKAGE_TIERS, {
            required_error: 'A package tier is required',
        }),
    }),
});

const sendConsultationLinkValidationSchema = z.object({
    body: z.object({
        consultationLink: z
            .string({ required_error: 'A consultation link is required' })
            .trim()
            .max(2000)
            .url('Enter a valid URL')
            .refine((value) => value.startsWith('https://'), 'The consultation link must start with https://'),
        subject: z.string({ required_error: 'An email subject is required' }).trim().min(1).max(200),
        message: z.string({ required_error: 'A message is required' }).trim().min(1).max(5000),
    }),
});

export const PackagePurchaseValidations = {
    createCheckoutSessionValidationSchema,
    sendConsultationLinkValidationSchema,
};
