import { z } from 'zod';
import { DELIVERY_CHANNELS, MESSAGE_APPROVAL_STATUS } from './message.constant';
import { ENUM_GENDER } from '../user/user.constant';

const createMessageValidationSchema = z.object({
    body: z.object({
        recipientName: z.string().trim().optional(),
        recipientEmail: z
            .string({ required_error: 'Recipient email is required' })
            .email('Invalid email address')
            .trim(),
        recipientPhone: z
            .string({ required_error: 'Recipient phone is required' })
            .trim()
            .min(1, 'Recipient phone is required'),
        recipientAge: z
            .string({ required_error: 'Recipient age is required' })
            .trim()
            .min(1, 'Recipient age is required'),
        recipientGender: z.enum(
            Object.values(ENUM_GENDER) as [string, ...string[]],
            { required_error: 'Recipient gender is required' }
        ),
        recipientRelationship: z.string().trim().optional(),
        channel: z.enum(DELIVERY_CHANNELS, {
            required_error: 'Delivery channel is required',
        }),
        topic: z.string({ required_error: 'Topic ID is required' }).min(1),
        customNote: z.string().trim().optional(),
        articles: z
            .array(z.string().min(1))
            .optional()
            .default([]),
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

