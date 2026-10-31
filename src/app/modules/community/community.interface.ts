import { Types, Model, Document } from 'mongoose';
import { COMMUNITY_CATEGORIES } from './community.constant';

export type TCommunityPostStatus = 'pending' | 'approved' | 'rejected' | 'needs_update';

export interface ICommunityReply {
    post: Types.ObjectId;
    author: Types.ObjectId;
    content: string;
}

export type CommunityReplyDocument = ICommunityReply & Document;
export type CommunityReplyModel = Model<CommunityReplyDocument>;

export interface ICommunityPost {
    author: Types.ObjectId;
    title: string;
    content: string;
    category: COMMUNITY_CATEGORIES;
    image?: string;
    likesCount: number;
    likedBy: Types.ObjectId[];
    repliesCount: number;
    isPinned: boolean;
    status: TCommunityPostStatus;
    feedback?: string;
    rejectionReason?: string;
    reviewedAt?: Date;
    reviewedBy?: Types.ObjectId;
    isDeleted: boolean;
}

export type CommunityPostDocument = ICommunityPost & Document;
export type CommunityPostModel = Model<CommunityPostDocument>;
