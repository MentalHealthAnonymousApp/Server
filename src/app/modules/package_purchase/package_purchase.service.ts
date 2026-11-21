import { Buffer } from 'buffer';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import Stripe from 'stripe';
import AppError from '../../error/appError';
import config from '../../config';
import { errorLogger } from '../../shared/logger';
import PackagePurchase from './package_purchase.model';
import { PackagePurchaseDocument, TPackageTier } from './package_purchase.interface';
import { PACKAGE_TIERS } from './package_purchase.constant';
import NormalUser from '../normal_user/normal_user.model';
import sendEmail from '../../utilities/sendEmail';
import { escapeHtml } from '../message/message.template';

const expectedAmountsMinor: Record<TPackageTier, number> = {
    basic: 4900,
    standard: 7900,
    premium: 14900,
};

let stripeClient: Stripe | undefined;

const getStripe = (): Stripe => {
    if (!config.stripe_secret_key) {
        throw new AppError(StatusCodes.SERVICE_UNAVAILABLE, 'Stripe is not configured');
    }
    stripeClient ??= new Stripe(config.stripe_secret_key);
    return stripeClient;
};

const priceIdForTier = (tier: TPackageTier): string => {
    const priceIds: Record<TPackageTier, string | undefined> = {
        basic: config.stripe_price_basic,
        standard: config.stripe_price_standard,
        premium: config.stripe_price_premium,
    };
    const priceId = priceIds[tier];
    if (!priceId) {
        throw new AppError(StatusCodes.SERVICE_UNAVAILABLE, `Stripe price is not configured for the ${tier} package`);
    }
    return priceId;
};

const websiteOrigin = (): string => {
    if (!config.website_url) {
        throw new AppError(StatusCodes.SERVICE_UNAVAILABLE, 'The website URL is not configured');
    }
    try {
        const url = new URL(config.website_url);
        if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
            throw new Error('HTTPS is required');
        }
        return url.origin;
    } catch {
        throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'The configured website URL is invalid');
    }
};

const createCheckoutSession = async (
    userId: string,
    email: string | undefined,
    packageTier: TPackageTier
) => {
    if (!Types.ObjectId.isValid(userId)) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'Authenticated user profile is invalid');
    }

    const stripe = getStripe();
    const priceId = priceIdForTier(packageTier);
    let price: Stripe.Price;
    try {
        price = await stripe.prices.retrieve(priceId);
    } catch (error) {
        errorLogger.error(`Unable to retrieve the configured Stripe price for ${packageTier}`, error);
        const stripeErrorCode =
            typeof error === 'object' && error !== null && 'code' in error
                ? error.code
                : undefined;
        if (stripeErrorCode === 'resource_missing') {
            throw new AppError(
                StatusCodes.SERVICE_UNAVAILABLE,
                `The configured ${packageTier} Stripe Price is unavailable for the current Stripe key. Use Price IDs and a secret key from the same mode (test or live).`
            );
        }
        throw new AppError(StatusCodes.BAD_GATEWAY, 'Could not verify the configured Stripe package price');
    }
    if (
        !price.active ||
        price.type !== 'one_time' ||
        price.currency !== 'usd' ||
        price.unit_amount !== expectedAmountsMinor[packageTier] ||
        typeof price.product !== 'string'
    ) {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `The Stripe price for ${packageTier} must be an active one-time USD price of $${expectedAmountsMinor[packageTier] / 100}`
        );
    }

    const baseUrl = websiteOrigin();
    const purchase = await PackagePurchase.create({
        userId: new Types.ObjectId(userId),
        packageTier,
        productId: price.product,
        providerPriceId: price.id,
        amountMinor: price.unit_amount,
        currency: price.currency,
        billingProvider: 'stripe',
        status: 'pending',
        fulfillmentStatus: 'pending',
        consultationSent: false,
        isDeleted: false,
    });

    const metadata = {
        purchaseId: purchase._id.toString(),
        userId,
        packageTier,
    };

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{ price: price.id, quantity: 1 }],
            client_reference_id: userId,
            customer_email: email,
            metadata,
            payment_intent_data: { metadata },
            success_url: `${baseUrl}/packages/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/packages?checkout=cancelled`,
        });

        if (!session.url) {
            throw new Error('Stripe did not return a Checkout URL');
        }

        const updateResult = await PackagePurchase.updateOne(
            { _id: purchase._id, status: 'pending' },
            { $set: { stripeCheckoutSessionId: session.id } }
        );
        if (updateResult.modifiedCount !== 1) {
            throw new Error('Could not link the Stripe Checkout session to its purchase');
        }

        return { checkoutUrl: session.url };
    } catch (error) {
        await PackagePurchase.updateOne(
            { _id: purchase._id, status: 'pending' },
            { $set: { status: 'failed' } }
        );
        errorLogger.error(`Unable to create Stripe Checkout for purchase ${purchase._id.toString()}`, error);
        throw new AppError(StatusCodes.BAD_GATEWAY, 'Could not create a Stripe Checkout session');
    }
};

const verifyCheckoutSession = async (sessionId: string, userId: string) => {
    if (!sessionId.startsWith('cs_') || !Types.ObjectId.isValid(userId)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid Checkout session');
    }

    const purchase = await PackagePurchase.findOne({
        stripeCheckoutSessionId: sessionId,
        userId: new Types.ObjectId(userId),
        billingProvider: 'stripe',
        isDeleted: false,
    }).select('_id packageTier amountMinor currency status fulfillmentStatus messageId');

    if (!purchase) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Package purchase was not found');
    }

    return {
        purchaseId: purchase._id.toString(),
        packageTier: purchase.packageTier,
        amountMinor: purchase.amountMinor,
        currency: purchase.currency,
        status: purchase.status,
        fulfillmentStatus: purchase.fulfillmentStatus,
        messageId: purchase.messageId?.toString(),
    };
};

const getMyUnusedCredits = async (userId: string) => {
    if (!Types.ObjectId.isValid(userId)) {
        throw new AppError(StatusCodes.UNAUTHORIZED, 'Authenticated user profile is invalid');
    }

    const purchases = await PackagePurchase.find({
        userId: new Types.ObjectId(userId),
        status: 'completed',
        fulfillmentStatus: 'pending',
        messageId: { $exists: false },
        isDeleted: false,
    })
        .select('_id packageTier paidAt createdAt')
        .sort({ paidAt: 1, createdAt: 1 });

    return purchases.map((purchase) => ({
        purchaseId: purchase._id.toString(),
        packageTier: purchase.packageTier,
        paidAt: purchase.paidAt,
    }));
};

const assertSessionMatchesPurchase = async (
    stripe: Stripe,
    session: Stripe.Checkout.Session,
    purchase: PackagePurchaseDocument | null
) => {
    if (!purchase || !session.id || session.payment_status !== 'paid') {
        throw new Error('The Checkout session is not paid or has no matching purchase');
    }
    if (
        (purchase.stripeCheckoutSessionId && purchase.stripeCheckoutSessionId !== session.id) ||
        purchase.billingProvider !== 'stripe' ||
        session.metadata?.purchaseId !== purchase._id.toString() ||
        session.metadata?.userId !== purchase.userId?.toString() ||
        session.metadata?.packageTier !== purchase.packageTier ||
        session.client_reference_id !== purchase.userId?.toString() ||
        session.currency?.toUpperCase() !== purchase.currency ||
        session.amount_total !== purchase.amountMinor
    ) {
        throw new Error('The paid Checkout session does not match the stored purchase');
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
    if (
        lineItems.data.length !== 1 ||
        lineItems.data[0].price?.id !== purchase.providerPriceId ||
        lineItems.data[0].quantity !== 1 ||
        lineItems.data[0].amount_total !== purchase.amountMinor
    ) {
        throw new Error('The paid Checkout line item does not match the stored package');
    }
};

const fulfillPaidSession = async (session: Stripe.Checkout.Session) => {
    if (!session.metadata?.purchaseId) {
        throw new Error('Stripe Checkout session is missing purchase metadata');
    }

    const stripe = getStripe();
    const purchase = await PackagePurchase.findById(session.metadata.purchaseId);
    await assertSessionMatchesPurchase(stripe, session, purchase);
    if (!purchase) return;

    const paymentIntentId =
        typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id;

    await PackagePurchase.updateOne(
        {
            _id: purchase._id,
            status: { $in: ['pending', 'failed', 'completed'] },
            $or: [
                { stripeCheckoutSessionId: session.id },
                { stripeCheckoutSessionId: { $exists: false } },
            ],
        },
        {
            $set: {
                status: 'completed',
                stripeCheckoutSessionId: session.id,
                providerTransactionId: paymentIntentId || session.id,
                amountMinor: session.amount_total!,
                currency: session.currency!.toUpperCase(),
                paidAt: purchase.paidAt || new Date(),
            },
        }
    );
};

const updateSessionFailure = async (
    session: Stripe.Checkout.Session,
    status: 'failed' | 'canceled'
) => {
    if (!session.metadata?.purchaseId) return;
    await PackagePurchase.updateOne(
        {
            _id: session.metadata.purchaseId,
            stripeCheckoutSessionId: session.id,
            status: 'pending',
        },
        { $set: { status } }
    );
};

const handleRefund = async (charge: Stripe.Charge) => {
    const paymentIntentId =
        typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
    if (!paymentIntentId) return;

    let purchase = await PackagePurchase.findOne({
        billingProvider: 'stripe',
        providerTransactionId: paymentIntentId,
    });
    if (!purchase) {
        const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
        const purchaseId = paymentIntent.metadata.purchaseId;
        if (purchaseId) {
            purchase = await PackagePurchase.findById(purchaseId);
            if (
                purchase?.billingProvider !== 'stripe' ||
                (purchase.providerTransactionId && purchase.providerTransactionId !== paymentIntentId)
            ) {
                purchase = null;
            }
        }
    }
    if (!purchase) return;

    const fullyRefunded = charge.amount_refunded >= purchase.amountMinor;
    await PackagePurchase.updateOne(
        { _id: purchase._id },
        {
            $set: {
                status: fullyRefunded ? 'refunded' : 'partially_refunded',
                refundedAt: new Date(),
                refundedAmountMinor: charge.amount_refunded,
                ...(purchase.fulfillmentStatus === 'pending'
                    ? { fulfillmentStatus: 'failed' }
                    : {}),
            },
        }
    );
};

const processStripeEvent = async (event: Stripe.Event) => {
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.payment_status === 'paid') {
                await fulfillPaidSession(session);
            }
            return;
        }
        case 'checkout.session.async_payment_succeeded':
            await fulfillPaidSession(event.data.object as Stripe.Checkout.Session);
            return;
        case 'checkout.session.async_payment_failed':
            await updateSessionFailure(event.data.object as Stripe.Checkout.Session, 'failed');
            return;
        case 'checkout.session.expired':
            await updateSessionFailure(event.data.object as Stripe.Checkout.Session, 'canceled');
            return;
        case 'charge.refunded':
            await handleRefund(event.data.object as Stripe.Charge);
            return;
        case 'charge.dispute.created': {
            const dispute = event.data.object as Stripe.Dispute;
            const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
            const charge = await getStripe().charges.retrieve(chargeId);
            const paymentIntentId =
                typeof charge.payment_intent === 'string'
                    ? charge.payment_intent
                    : charge.payment_intent?.id;
            if (paymentIntentId) {
                await PackagePurchase.updateOne(
                    { billingProvider: 'stripe', providerTransactionId: paymentIntentId },
                    { $set: { status: 'disputed' } }
                );
            }
            return;
        }
        default:
            return;
    }
};

const handleStripeWebhook = async (body: Buffer, signature: string | undefined) => {
    if (!config.stripe_webhook_secret) {
        throw new AppError(StatusCodes.SERVICE_UNAVAILABLE, 'Stripe webhook is not configured');
    }
    if (!signature) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Missing Stripe signature');
    }

    let event: Stripe.Event;
    try {
        event = getStripe().webhooks.constructEvent(body, signature, config.stripe_webhook_secret);
    } catch {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid Stripe webhook signature');
    }

    try {
        await processStripeEvent(event);
    } catch (error) {
        errorLogger.error(`Stripe webhook processing failed for event ${event.id}`, error);
        throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Stripe webhook processing failed');
    }
};

/* ------------------------------------------------------------------ */
/*  Admin dashboard                                                     */
/* ------------------------------------------------------------------ */

// Purchases where money actually changed hands (excludes abandoned / failed checkouts).
const PAID_STATUSES = ['completed', 'partially_refunded', 'refunded', 'disputed'];

const ADMIN_PURCHASE_POPULATE = [
    { path: 'userId', select: 'firstName lastName email phone profile_image' },
    { path: 'messageId', select: 'status channel topic', populate: { path: 'topic', select: 'name' } },
];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAdminPurchases = async (query: Record<string, unknown>) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

    const filter: Record<string, unknown> = { isDeleted: false, status: { $in: PAID_STATUSES } };

    if (typeof query.packageTier === 'string' && (PACKAGE_TIERS as readonly string[]).includes(query.packageTier)) {
        filter.packageTier = query.packageTier;
    }
    if (query.consultation === 'pending' || query.consultation === 'sent') {
        filter.packageTier = 'premium';
        filter.consultationSent = query.consultation === 'sent';
        if (query.consultation === 'pending') filter.status = 'completed';
    }

    if (typeof query.searchTerm === 'string' && query.searchTerm.trim()) {
        const regex = new RegExp(escapeRegex(query.searchTerm.trim().slice(0, 100)), 'i');
        // Resolve matching customers first, then match purchases by userId or transaction reference.
        const users = await NormalUser.find({ $or: [{ firstName: regex }, { lastName: regex }, { email: regex }] })
            .select('_id')
            .limit(500)
            .lean();
        filter.$or = [
            { userId: { $in: users.map((user) => user._id) } },
            { providerTransactionId: regex },
            { stripeCheckoutSessionId: regex },
        ];
    }

    const [data, total] = await Promise.all([
        PackagePurchase.find(filter)
            .select('-__v')
            .populate(ADMIN_PURCHASE_POPULATE)
            .sort({ paidAt: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        PackagePurchase.countDocuments(filter),
    ]);

    return { meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, data };
};

/** All dashboard KPIs in one aggregation. Amounts are in minor units (cents), net of refunds. */
const getAdminPurchaseStats = async () => {
    const [result] = await PackagePurchase.aggregate<{
        tiers: { _id: TPackageTier; count: number; revenueMinor: number }[];
        pendingConsultations: { count: number }[];
    }>([
        { $match: { isDeleted: false, status: { $in: PAID_STATUSES } } },
        {
            $facet: {
                tiers: [
                    {
                        $group: {
                            _id: '$packageTier',
                            count: { $sum: 1 },
                            revenueMinor: {
                                $sum: { $subtract: ['$amountMinor', { $ifNull: ['$refundedAmountMinor', 0] }] },
                            },
                        },
                    },
                ],
                pendingConsultations: [
                    { $match: { packageTier: 'premium', status: 'completed', consultationSent: false } },
                    { $count: 'count' },
                ],
            },
        },
    ]);

    const tiers = Object.fromEntries(
        PACKAGE_TIERS.map((tier) => [tier, { count: 0, revenueMinor: 0 }])
    ) as Record<TPackageTier, { count: number; revenueMinor: number }>;
    for (const row of result?.tiers ?? []) tiers[row._id] = { count: row.count, revenueMinor: row.revenueMinor };

    return {
        totalCount: PACKAGE_TIERS.reduce((sum, tier) => sum + tiers[tier].count, 0),
        totalRevenueMinor: PACKAGE_TIERS.reduce((sum, tier) => sum + tiers[tier].revenueMinor, 0),
        currency: 'USD',
        tiers,
        pendingConsultations: result?.pendingConsultations[0]?.count ?? 0,
    };
};

const sendConsultationLink = async (
    purchaseId: string,
    payload: { consultationLink: string; subject: string; message: string }
) => {
    if (!Types.ObjectId.isValid(purchaseId)) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid purchase ID');
    }

    const purchase = await PackagePurchase.findOne({ _id: purchaseId, isDeleted: false })
        .select('packageTier status userId')
        .populate<{ userId: { email?: string } | null }>('userId', 'email');
    if (!purchase) throw new AppError(StatusCodes.NOT_FOUND, 'Package purchase not found');
    if (purchase.packageTier !== 'premium') {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Only Premium packages include a consultation');
    }
    if (purchase.status !== 'completed') {
        throw new AppError(
            StatusCodes.CONFLICT,
            `A ${purchase.status.replace('_', ' ')} purchase cannot receive a consultation link`
        );
    }
    const email = purchase.userId?.email;
    if (!email) {
        throw new AppError(StatusCodes.UNPROCESSABLE_ENTITY, 'This customer has no email address on file');
    }

    const link = escapeHtml(payload.consultationLink);
    const html = `<!doctype html><html><body style="margin:0;background:#f4f7f4;font-family:Arial,Helvetica,sans-serif;color:#26332d">
      <div style="max-width:560px;margin:0 auto;padding:32px 20px">
        <div style="background:#ffffff;border-radius:16px;padding:28px">
          <p style="margin:0 0 20px;line-height:1.6;white-space:pre-wrap">${escapeHtml(payload.message)}</p>
          <a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:24px;background:#2e5e52;color:#ffffff;font-weight:700;text-decoration:none">Join your consultation</a>
          <p style="margin:20px 0 0;font-size:12px;color:#6b7a73;word-break:break-all">Or open this link: ${link}</p>
        </div>
      </div></body></html>`;

    try {
        await sendEmail({ email, subject: payload.subject, html });
    } catch (error) {
        errorLogger.error(`Consultation email failed for purchase ${purchaseId}`, error);
        throw new AppError(
            StatusCodes.BAD_GATEWAY,
            'The email provider did not accept the consultation email. Please try again.'
        );
    }

    return PackagePurchase.findByIdAndUpdate(
        purchaseId,
        {
            $set: {
                consultationLink: payload.consultationLink,
                consultationNotes: payload.message,
                consultationSent: true,
                consultationSentAt: new Date(),
            },
        },
        { new: true }
    )
        .populate(ADMIN_PURCHASE_POPULATE)
        .lean();
};

const PackagePurchaseServices = {
    createCheckoutSession,
    verifyCheckoutSession,
    getMyUnusedCredits,
    handleStripeWebhook,
    getAdminPurchases,
    getAdminPurchaseStats,
    sendConsultationLink,
};

export default PackagePurchaseServices;
