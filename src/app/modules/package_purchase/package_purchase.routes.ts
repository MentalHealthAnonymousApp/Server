import express from 'express';
import rateLimit from 'express-rate-limit';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import PackagePurchaseController from './package_purchase.controller';
import { PackagePurchaseValidations } from './package_purchase.validation';

const router = express.Router();

const checkoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Checkout attempts are temporarily limited. Please try again later.',
    },
});

router.post(
    '/checkout-session',
    auth(USER_ROLE.user),
    checkoutLimiter,
    validateRequest(PackagePurchaseValidations.createCheckoutSessionValidationSchema),
    PackagePurchaseController.createCheckoutSession
);

router.get(
    '/session/:sessionId',
    auth(USER_ROLE.user),
    PackagePurchaseController.getCheckoutSession
);

router.get(
    '/my-credits',
    auth(USER_ROLE.user),
    PackagePurchaseController.getMyUnusedCredits
);

export const packagePurchaseRoutes = router;
export default packagePurchaseRoutes;
