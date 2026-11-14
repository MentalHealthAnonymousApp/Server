export const PACKAGE_TIERS = ['basic', 'standard', 'premium'] as const;
export const PURCHASE_STATUS = [
    'pending',
    'completed',
    'failed',
    'canceled',
    'refunded',
    'partially_refunded',
    'disputed',
] as const;
export const BILLING_PROVIDERS = ['stripe', 'apple_app_store', 'google_play'] as const;
export const PAYMENT_METHODS = ['card', 'apple_pay', 'google_pay', 'unknown'] as const;
export const FULFILLMENT_STATUSES = ['pending', 'fulfilled', 'failed'] as const;
