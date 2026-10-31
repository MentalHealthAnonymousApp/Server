import { Schema, model } from 'mongoose';
import { ResourceDocument, ResourceModel } from './resource.interface';
import { RESOURCE_STATUS, } from './resource.constant';



const resourceSchema = new Schema<ResourceDocument, ResourceModel>(
    {
        topic: {
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

