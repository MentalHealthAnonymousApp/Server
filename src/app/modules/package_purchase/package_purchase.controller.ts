import { Buffer } from 'buffer';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../error/appError';
import { errorLogger } from '../../shared/logger';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import PackagePurchaseServices from './package_purchase.service';
import { TPackageTier } from './package_purchase.interface';

const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user?.profileId) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized');
    }

    const result = await PackagePurchaseServices.createCheckoutSession(
        user.profileId,
        typeof user.email === 'string' ? user.email : undefined,
        req.body.packageTier as TPackageTier
    );

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: 'Stripe Checkout session created',
        data: result,
    });
});

const getCheckoutSession = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user?.profileId) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized');
    }

    const result = await PackagePurchaseServices.verifyCheckoutSession(
        req.params.sessionId,
        user.profileId
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Package purchase status fetched',
        data: result,
    });
});

const getMyUnusedCredits = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user?.profileId) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'You are not authorized');
    }

    const result = await PackagePurchaseServices.getMyUnusedCredits(user.profileId);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Your unused package credits fetched successfully',
        data: result,
    });
});

const handleStripeWebhook = async (req: Request, res: Response) => {
    if (!Buffer.isBuffer(req.body)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'Stripe webhook requires an unparsed request body',
        });
    }

    try {
        await PackagePurchaseServices.handleStripeWebhook(
            req.body,
            req.get('stripe-signature')
        );
        return res.status(StatusCodes.OK).json({ received: true });
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
        errorLogger.error('Unexpected Stripe webhook controller failure', error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Stripe webhook processing failed',
        });
    }
};

const PackagePurchaseController = {
    createCheckoutSession,
    getCheckoutSession,
    getMyUnusedCredits,
    handleStripeWebhook,
};

export default PackagePurchaseController;
