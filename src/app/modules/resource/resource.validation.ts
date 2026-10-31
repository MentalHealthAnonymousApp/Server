import { z } from 'zod';
import { RESOURCE_STATUS } from './resource.constant';

const createResourceValidationSchema = z.object({
    body: z.object({
        topic: z.string({ required_error: 'Topic ID is required' }),
        title: z.string({ required_error: 'Title is required' }).min(1).trim(),
        slug: z.string().trim().optional(),
        shortDescription: z.string({ required_error: 'Short description is required' }).min(1).trim(),
        contentHtml: z.string({ required_error: 'Content HTML is required' }).min(1),
        readingTime: z.number().int().nonnegative().optional().default(5),
        featuredImage: z.string().optional().default(''),
        isFeatured: z.boolean().optional().default(false),
        status: z.enum(RESOURCE_STATUS).optional().default('published'),
    }),
});

const updateResourceValidationSchema = z.object({
    body: z.object({
        topic: z.string().optional(),
        title: z.string().min(1).trim().optional(),
        slug: z.string().trim().optional(),
        shortDescription: z.string().min(1).trim().optional(),
        contentHtml: z.string().min(1).optional(),
        readingTime: z.number().int().nonnegative().optional(),
        featuredImage: z.string().optional(),
        isFeatured: z.boolean().optional(),
        status: z.enum(RESOURCE_STATUS).optional(),
    }),
});

export const ResourceValidations = {
    createResourceValidationSchema,
    updateResourceValidationSchema,
};

export default ResourceValidations;

