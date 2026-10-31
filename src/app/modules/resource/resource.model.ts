import { Schema, model } from 'mongoose';
import { ResourceDocument, ResourceModel } from './resource.interface';
import { RESOURCE_STATUS, REVIEW_STATUS } from './resource.constant';

const resourceLinkSchema = new Schema(
    {
        title: { type: String, required: true },
        url: { type: String, required: true },
        description: { type: String },
        linkType: {
            type: String,
            enum: ['website', 'helpline', 'organization', 'article', 'video'],
            default: 'website',
        },
    },
    { _id: false }
);

const resourceSafetySchema = new Schema(
    {
        hasCrisisInformation: { type: Boolean, default: false },
        crisisResources: { type: [resourceLinkSchema], default: [] },
        disclaimer: { type: String, default: '' },
    },
    { _id: false }
);

const resourceSchema = new Schema<ResourceDocument, ResourceModel>(
    {
        topicId: {
            type: Schema.Types.ObjectId,
            ref: 'Topic',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            trim: true,
            lowercase: true,
        },
        shortDescription: {
            type: String,
            required: true,
            trim: true,
        },
        contentHtml: {
            type: String,
            required: true,
        },
        readingTime: {
            type: Number,
            default: 5,
        },
        featuredImage: {
            type: String,
            default: '',
        },
        category: {
            type: String,
            default: 'Educational Guide',
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: RESOURCE_STATUS,
            default: 'published',
            index: true,
        },
        reviewedBy: {
            type: String,
        },
        reviewedAt: {
            type: Date,
        },
        reviewStatus: {
            type: String,
            enum: REVIEW_STATUS,
            default: 'approved',
        },
        safety: {
            type: resourceSafetySchema,
        },
        sections: {
            type: [Schema.Types.Mixed],
            default: [],
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

export const Resource = model<ResourceDocument, ResourceModel>('Resource', resourceSchema);
export default Resource;

