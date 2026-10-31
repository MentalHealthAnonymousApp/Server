import { Types, Model, Document } from 'mongoose';

export type TCommunityPostStatus = 'pending' | 'approved' | 'rejected' | 'needs_update';

export interface ICommunityReply {
    postId: Types.ObjectId;
    authorId?: Types.ObjectId;
    authorName: string;
    authorBadge?: string;
    content: string;
    likesCount: number;
    likedBy: Types.ObjectId[];
    isDeleted: boolean;
}

export type CommunityReplyDocument = ICommunityReply & Document;
export type CommunityReplyModel = Model<CommunityReplyDocument>;

export interface ICommunityPost {
    authorId?: Types.ObjectId;
    authorName: string;
    authorRole?: string;
    title: string;
    content: string;
    category: string;
    topicTag: string;
    imageUrl?: string;
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

