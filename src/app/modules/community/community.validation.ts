import { z } from 'zod';
import { COMMUNITY_CATEGORIES, COMMUNITY_POST_STATUS } from './community.constant';

const categorySchema = z
    .nativeEnum(COMMUNITY_CATEGORIES)
    .refine((category) => category !== COMMUNITY_CATEGORIES.ALL_DISCUSSIONS, {
        message: 'Select a specific community category',
    });

const createCommunityPostValidationSchema = z.object({
    body: z.object({
        title: z.string().min(1, 'Title is required').trim(),
        content: z.string().min(1, 'Content is required').trim(),
        category: categorySchema,
        image: z.string().trim().optional(),
    }),
});

const updateCommunityPostValidationSchema = z.object({
    body: z
        .object({
            title: z.string().min(1).trim().optional(),
            content: z.string().min(1).trim().optional(),
            category: categorySchema.optional(),
            image: z.string().trim().optional(),
        })
        .refine((body) => Object.keys(body).length > 0, {
            message: 'At least one post field must be provided',
        }),
});

const moderateCommunityPostValidationSchema = z.object({
    body: z.object({
        status: z.enum(COMMUNITY_POST_STATUS),
        feedback: z.string().trim().optional(),
        rejectionReason: z.string().trim().optional(),
    }),
});

const createCommunityReplyValidationSchema = z.object({
    body: z.object({
        content: z.string().min(1, 'Reply content is required').trim(),
    }),
});

export const CommunityValidations = {
    createCommunityPostValidationSchema,
    updateCommunityPostValidationSchema,
    moderateCommunityPostValidationSchema,
    createCommunityReplyValidationSchema,
};

export default CommunityValidations;
