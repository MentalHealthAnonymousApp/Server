import { Types, Model, Document } from 'mongoose';
import { COMMUNITY_CATEGORIES } from './community.constant';

export type TCommunityPostStatus = 'pending' | 'approved' | 'rejected' | 'needs_update';

export interface ICommunityReply {
    post: Types.ObjectId;
    content: string;
}

export type CommunityReplyDocument = ICommunityReply & Document;
export type CommunityReplyModel = Model<CommunityReplyDocument>;

export interface ICommunityPost {
    author: Types.ObjectId;
    title: string;
    content: string;
    category: (typeof COMMUNITY_CATEGORIES)[keyof typeof COMMUNITY_CATEGORIES]
    image?: string;
    likesCount: number;
    likedBy: Types.ObjectId[];
    repliesCount: number;
    isPinned: boolean;
    status: TCommunityPostStatus;
    rejectionReason?: string;
    reviewedAt?: Date;
    isDeleted: boolean;
}

export type CommunityPostDocument = ICommunityPost & Document;
export type CommunityPostModel = Model<CommunityPostDocument>;

