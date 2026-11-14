import { z } from 'zod';
import { PACKAGE_TIERS } from './package_purchase.constant';

const createCheckoutSessionValidationSchema = z.object({
    body: z.object({
        packageTier: z.enum(PACKAGE_TIERS, {
            required_error: 'A package tier is required',
        }),
    }),
});

export const PackagePurchaseValidations = {
    createCheckoutSessionValidationSchema,
};
