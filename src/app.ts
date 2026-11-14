/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application } from 'express';
import sendContactUsEmail from './app/helper/sendContactUsEmail';

import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import { rateLimiters } from './app/middlewares/rateLimiter.middleware';
import router from './app/routes';
import PackagePurchaseController from './app/modules/package_purchase/package_purchase.controller';

const app: Application = express();
// VERY IMPORTANT (for proxy / nginx)
app.set('trust proxy', 1);
app.post(
    '/api/v1/package-purchase/stripe-webhook',
    express.raw({ type: 'application/json' }),
    PackagePurchaseController.handleStripeWebhook
);
// parser----------------
app.use(express.json());
app.use(cookieParser());
app.use(
    cors({
        origin: [
            'http://localhost:3007',
            'http://localhost:3008',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://10.10.20.48:3000',
            'http://localhost:9090',
            'http://10.10.20.43:9090',
            "http://localhost:5173"
        ],
        credentials: true,
    })
);
app.use('/uploads', express.static('uploads'));
// application routers ----------------

app.use(rateLimiters.apiLimiter);
app.use('/api/v1', router);
app.post('/contact-us', sendContactUsEmail);

app.get('/', async (req, res) => {
    res.send({ message: 'nice to meet you 2' });
});

// global error handler
app.use(globalErrorHandler);
// not found
app.use(notFound);

export default app;
