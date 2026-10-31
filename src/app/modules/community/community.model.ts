import { Schema, model } from 'mongoose';
import {
    CommunityPostDocument,
    CommunityPostModel,
    CommunityReplyDocument,
    CommunityReplyModel,
} from './community.interface';
import { COMMUNITY_CATEGORIES, COMMUNITY_POST_STATUS } from './community.constant';

const communityReplySchema = new Schema<CommunityReplyDocument, CommunityReplyModel>(
    {
        post: {
            type: Schema.Types.ObjectId,
            ref: 'CommunityPost',
            required: true,
            index: true,
        },

        content: {
            type: String,
            required: true,
            trim: true,
        },

    },
    {
        timestamps: true,
    }
);

export const CommunityReply = model<CommunityReplyDocument, CommunityReplyModel>(
    'CommunityReply',
    communityReplySchema
);

const communityPostSchema = new Schema<CommunityPostDocument, CommunityPostModel>(
    {
        author: {
            type: Schema.Types.ObjectId,
            ref: 'NormalUser',
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            enum: Object.values(COMMUNITY_CATEGORIES),
        },
        image: {
            type: String,
            default: '',
        },
        likesCount: {
            type: Number,
            default: 0,
        },
        likedBy: [
            {
                type: Schema.Types.ObjectId,
                ref: 'NormalUser',
            },
        ],
        repliesCount: {
            type: Number,
            default: 0,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: COMMUNITY_POST_STATUS,
            default: 'approved',
            index: true,
        },

        rejectionReason: {
            type: String,
        },
        reviewedAt: {
            type: Date,
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

export const CommunityPost = model<CommunityPostDocument, CommunityPostModel>(
    'CommunityPost',
    communityPostSchema
);
export default CommunityPost;

