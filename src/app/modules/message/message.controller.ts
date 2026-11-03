import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import MessageServices from './message.service';

/* ------------------------------------------------------------------ */
/*  User                                                                */
/* ------------------------------------------------------------------ */

const createMessage = catchAsync(async (req, res) => {
    const result = await MessageServices.createMessageIntoDB(req.user, req.body);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: 'Message submitted successfully and is pending review',
        data: result,
    });
});

const getMyMessages = catchAsync(async (req, res) => {
    const result = await MessageServices.getMyMessagesFromDB(req.user, req.query);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Your messages fetched successfully',
        meta: result.meta,
        data: result.data,
    });
});

/* ------------------------------------------------------------------ */
/*  Admin                                                               */
/* ------------------------------------------------------------------ */

const getAllMessages = catchAsync(async (req, res) => {
    const result = await MessageServices.getAllMessagesFromDB(req.query);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Messages fetched successfully',
        meta: result.meta,
        data: result.data,
    });
});

const getSingleMessage = catchAsync(async (req, res) => {
    const result = await MessageServices.getSingleMessageFromDB(req.params.id);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Message fetched successfully',
        data: result,
    });
});

const updateMessageStatus = catchAsync(async (req, res) => {
    const result = await MessageServices.updateMessageStatusIntoDB(
        req.params.id,
        req.body
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Message status updated successfully',
        data: result,
    });
});

const deleteMessage = catchAsync(async (req, res) => {
    const result = await MessageServices.deleteMessageFromDB(req.params.id);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Message deleted successfully',
        data: result,
    });
});

export const MessageController = {
    createMessage,
    getMyMessages,
    getAllMessages,
    getSingleMessage,
    updateMessageStatus,
    deleteMessage,
};

export default MessageController;

