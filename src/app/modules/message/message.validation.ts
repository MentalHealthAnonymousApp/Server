import { z } from 'zod';
import { DELIVERY_CHANNELS, MESSAGE_APPROVAL_STATUS } from './message.constant';

const createMessageValidationSchema = z.object({
    body: z.object({
        recipientName: z.string().trim().max(100).optional(),
        recipientEmail: z.string().trim().email('Invalid email address').max(254).optional(),
        recipientPhone: z.string().trim().max(25).optional(),
        channel: z.enum(DELIVERY_CHANNELS, {
            required_error: 'Delivery channel is required',
        }),
        senderAttestation: z.literal(true, {
            errorMap: () => ({ message: 'Please confirm this message is appropriate to send' }),
        }),
        topic: z.string({ required_error: 'Topic ID or slug is required' }).trim().min(1).max(100),
        packagePurchaseId: z.string().regex(/^[a-f\d]{24}$/i, 'A valid package purchase ID is required'),
        customNote: z.string().trim().max(500).optional(),
        articles: z
            .array(z.string().min(1).max(100))
            .max(5, 'You can attach up to 5 resources')
            .optional()
            .default([]),
    }).superRefine((body, context) => {
        if (body.articles && new Set(body.articles).size !== body.articles.length) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['articles'],
                message: 'Selected resources must not contain duplicates',
            });
        }
        if (body.channel === 'email' && !body.recipientEmail) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['recipientEmail'],
                message: 'Recipient email is required for email delivery',
            });
        }
        if (body.channel === 'sms') {
            if (!body.recipientPhone) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['recipientPhone'],
                    message: 'Recipient phone is required for SMS delivery',
                });
            } else if (!/^\+[1-9]\d{7,14}$/.test(body.recipientPhone)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['recipientPhone'],
                    message: 'Recipient phone must use international E.164 format',
                });
            }
        }
    }),
});

const updateMessageStatusValidationSchema = z.object({
    body: z.object({
        status: z.enum(MESSAGE_APPROVAL_STATUS, {
            required_error: 'Status is required',
        }),
        rejectionReason: z.string().trim().optional(),
    }),
});

export const MessageValidations = {
    createMessageValidationSchema,
    updateMessageStatusValidationSchema,
};

export default MessageValidations;
