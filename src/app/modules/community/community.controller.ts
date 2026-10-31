import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import CommunityServices from './community.service';

const getAllCommunityPosts = catchAsync(async (req, res) => {
    const result = await CommunityServices.getAllCommunityPostsFromDB(req.query);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Community posts fetched successfully',
        meta: result.meta,
        data: result.data,
    });
});

const getModerationQueue = catchAsync(async (req, res) => {
    const result = await CommunityServices.getAllCommunityPostsFromDB(req.query, true);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Community posts fetched successfully',
        meta: result.meta,
        data: result.data,
    });
});

const getSingleCommunityPost = catchAsync(async (req, res) => {
    const result = await CommunityServices.getSingleCommunityPostFromDB(req.params.id);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Community post fetched successfully',
        data: result,
    });
});

const getModerationPost = catchAsync(async (req, res) => {
    const result = await CommunityServices.getSingleCommunityPostFromDB(req.params.id, true);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Community post fetched successfully',
        data: result,
    });
});

const createCommunityPost = catchAsync(async (req, res) => {
    const result = await CommunityServices.createCommunityPostIntoDB(req.user.profileId, req.body);
    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: 'Community post submitted for review',
        data: result,
    });
});

const updateCommunityPost = catchAsync(async (req, res) => {
    const result = await CommunityServices.updateCommunityPostIntoDB(
        req.params.id,
        req.user.profileId,
        req.body
    );
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Community post updated successfully',
        data: result,
    });
});

const deleteCommunityPost = catchAsync(async (req, res) => {
    const result = await CommunityServices.deleteCommunityPostFromDB(
        req.params.id,
        req.user.profileId,
        req.user.role
    );
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Community post deleted successfully',
        data: result,
    });
});

const moderateCommunityPost = catchAsync(async (req, res) => {
    const result = await CommunityServices.moderateCommunityPostIntoDB(
        req.params.id,
        req.user.profileId,
        req.body
    );
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Community post moderation updated successfully',
        data: result,
    });
});

const toggleCommunityPostLike = catchAsync(async (req, res) => {
    const result = await CommunityServices.toggleCommunityPostLikeInDB(
        req.params.id,
        req.user.profileId
    );
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Community post reaction updated successfully',
        data: result,
    });
});

const getCommunityReplies = catchAsync(async (req, res) => {
    const result = await CommunityServices.getCommunityRepliesFromDB(
        req.params.id,
        req.query
    );
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Community replies fetched successfully',
        meta: result.meta,
        data: result.data,
    });
});

const createCommunityReply = catchAsync(async (req, res) => {
    const result = await CommunityServices.createCommunityReplyInDB(
        req.params.id,
        req.user.profileId,
        req.body.content
    );
    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: 'Community reply created successfully',
        data: result,
    });
});

const deleteCommunityReply = catchAsync(async (req, res) => {
    const result = await CommunityServices.deleteCommunityReplyFromDB(
        req.params.id,
        req.params.replyId,
        req.user.profileId,
        req.user.role
    );
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Community reply deleted successfully',
        data: result,
    });
});

export const CommunityController = {
    getAllCommunityPosts,
    getModerationQueue,
    getSingleCommunityPost,
    getModerationPost,
    createCommunityPost,
    updateCommunityPost,
    deleteCommunityPost,
    moderateCommunityPost,
    toggleCommunityPostLike,
    getCommunityReplies,
    createCommunityReply,
    deleteCommunityReply,
};

export default CommunityController;
