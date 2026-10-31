import { z } from 'zod';
import { TOPIC_TONES } from './topic.constant';

const createTopicValidationSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Topic name is required').trim(),
        slug: z.string().trim().optional(),
        shortDescription: z.string().min(1, 'Short description is required').trim(),
        tone: z.enum(TOPIC_TONES).optional().default('sky'),
        icon: z.string().optional().default('heart'),
    }),
});

const updateTopicValidationSchema = z.object({
    body: z.object({
        name: z.string().min(1).trim().optional(),
        slug: z.string().trim().optional(),
        shortDescription: z.string().min(1).trim().optional(),
        tone: z.enum(TOPIC_TONES).optional(),
        icon: z.string().optional(),
    }),
});

export const TopicValidations = {
    createTopicValidationSchema,
    updateTopicValidationSchema,
};

export default TopicValidations;
