export const DELIVERY_CHANNELS = ['sms', 'email'] as const;
export const MESSAGE_APPROVAL_STATUS = ['pending', 'approved', 'rejected', 'delivered'] as const;
export const DELIVERY_STATUS = ['queued', 'delivered', 'failed'] as const;
export const ADMIN_REVIEW_DECISIONS = ['approved', 'rejected'] as const;

// A pending message is auto-approved and sent if no admin reviews it within this window.
export const MESSAGE_AUTO_APPROVE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
// Max messages the auto-approval job processes per run (keeps each run short).
export const MESSAGE_AUTO_APPROVE_BATCH_SIZE = 50;
