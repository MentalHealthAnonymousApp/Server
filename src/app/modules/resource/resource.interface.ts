import { Types, Model, Document } from 'mongoose';

export type TResourceStatus = 'published' | 'draft';
export type TReviewStatus = 'pending' | 'approved' | 'rejected';

export interface IResourceLink {
    title: string;
    url: string;
    description?: string;
    linkType?: 'website' | 'helpline' | 'organization' | 'article' | 'video';
}

export interface IResourceSafety {
    hasCrisisInformation: boolean;
    crisisResources?: IResourceLink[];
    disclaimer?: string;
}

export interface IResource {
    topicId: Types.ObjectId;
    title: string;
    slug?: string;
    shortDescription: string;
    contentHtml: string;
    readingTime: number;
    featuredImage?: string;
    category?: string;
    isFeatured: boolean;
    status: TResourceStatus;
    reviewedBy?: string;
    reviewedAt?: Date;
    reviewStatus: TReviewStatus;
    safety?: IResourceSafety;
    sections?: Record<string, any>[];
    isDeleted: boolean;
}

export type ResourceDocument = IResource & Document;

export type ResourceModel = Model<ResourceDocument>;

