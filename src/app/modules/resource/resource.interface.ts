import { Types, Model, Document } from 'mongoose';

export type TResourceStatus = 'published' | 'draft';

export interface IResource {
    topic: Types.ObjectId;
    title: string;
    slug?: string;
    shortDescription: string;
    contentHtml: string;
    readingTime: number;
    featuredImage?: string;
    isFeatured: boolean;
    status: TResourceStatus;
    isDeleted: boolean;
}

export type ResourceDocument = IResource & Document;

export type ResourceModel = Model<ResourceDocument>;

