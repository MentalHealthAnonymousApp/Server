import { randomUUID } from 'crypto';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import MessageServices from './message.service';
import AppError from '../../error/appError';
import { Request, Response } from 'express';
import { errorLogger } from '../../shared/logger';

/* ------------------------------------------------------------------ */
/*  User                                                                */
/* ------------------------------------------------------------------ */

const createMessage = async (req: Request, res: Response) => {
    try {
        const idempotencyKey = req.get('Idempotency-Key')?.trim();
        if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
            throw new AppError(StatusCodes.BAD_REQUEST, 'A valid Idempotency-Key UUID header is required');
        }

        const result = await MessageServices.createMessageIntoDB(req.user, req.body, idempotencyKey);

        return sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: 'Message accepted for delivery',
            data: result,
        });
    } catch (error) {
        const requestId = randomUUID();
        const statusCode = error instanceof AppError ? error.statusCode : StatusCodes.INTERNAL_SERVER_ERROR;
        const message = error instanceof AppError
            ? error.message
            : 'The message could not be processed due to a server error. Please try again later.';

        if (statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) {
            const details = error instanceof Error
                ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
                : String(error);
            const sanitizedDetails = details
                .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
                .replace(/\+[1-9]\d{7,14}/g, '[phone]');
            errorLogger.error(`[message-api:${requestId}] ${sanitizedDetails}`);
        }

        return res.status(statusCode).json({
            success: false,
            message,
            error: message,
            requestId,
        });
    }
};

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
    const result = await MessageServices.getSingleMessageFromDB(req.params.id, req.user);

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
