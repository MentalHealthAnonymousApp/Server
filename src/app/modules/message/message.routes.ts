import { randomUUID } from 'crypto';
import express, { ErrorRequestHandler } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import MessageController from './message.controller';
import MessageValidations from './message.validation';
import AppError from '../../error/appError';
import { ZodError } from 'zod';
import { errorLogger } from '../../shared/logger';

const router = express.Router();
const messageRequestErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    void _next;
    const requestId = randomUUID();
    let statusCode = 500;
    let message = 'The message request could not be processed due to a server error. Please try again later.';

    if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
    } else if (error instanceof ZodError) {
        statusCode = 400;
        message = error.issues.map((issue) => issue.message).join('. ');
    } else if (
        error instanceof Error &&
        ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name)
    ) {
        statusCode = 401;
        message = 'Your sign-in session is invalid or expired. Please sign in again.';
    }

    if (statusCode >= 500) {
        const details = error instanceof Error
            ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
            : String(error);
        const sanitizedDetails = details
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
            .replace(/\+[1-9]\d{7,14}/g, '[phone]');
        errorLogger.error(`[message-api:${requestId}] ${req.method} ${req.originalUrl}\n${sanitizedDetails}`);
    }

    res.status(statusCode).json({
        success: false,
        message,
        error: message,
        requestId,
    });
};

const messageSendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id
        ? `user:${req.user.id}`
        : ipKeyGenerator(req.ip || ''),
    message: {
        success: false,
        message: 'Message sending limit reached. Please try again later.',
    },
});

/*  User routes                                                         */

// Submit a new message (normal users only)
router.post(
    '/',
    auth(
        USER_ROLE.user,
    ),
    messageSendLimiter,
    validateRequest(MessageValidations.createMessageValidationSchema),
    MessageController.createMessage,
    messageRequestErrorHandler
);

// Get own submitted messages
router.get(
    '/my-messages',
    auth(
        USER_ROLE.user,
    ),
    MessageController.getMyMessages
);

/*  Admin routes                                                        */

// Get all messages (with filters)
router.get(
    '/',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    MessageController.getAllMessages
);

// Dashboard counters (must be registered before '/:id')
router.get(
    '/stats',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    MessageController.getMessageStats
);

// Get single message detail
router.get(
    '/:id',
    auth(USER_ROLE.user, USER_ROLE.admin, USER_ROLE.superAdmin),
    MessageController.getSingleMessage
);

// Approve (sends the message, or retries a failed delivery) / reject (returns the package credit)
router.patch(
    '/:id/status',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    validateRequest(MessageValidations.updateMessageStatusValidationSchema),
    MessageController.updateMessageStatus
);

// Soft-delete a message
router.delete(
    '/:id',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    MessageController.deleteMessage
);

export const messageRoutes = router;
export default messageRoutes;
