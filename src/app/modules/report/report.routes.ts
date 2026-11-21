import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import ReportController from './report.controller';
import { REPORT_REASONS } from './report.constant';

const router = express.Router();
const adminOnly = auth(USER_ROLE.admin, USER_ROLE.superAdmin);

const publicReadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
const publicSubmitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many reports from this network. Please try again later.' },
});

const submitReportValidationSchema = z.object({
    body: z.object({
        ref: z.string({ required_error: 'The report link is missing its reference' }).trim().min(20).max(64),
        reasonCategory: z.enum(REPORT_REASONS, { required_error: 'Please choose a reason' }),
        reasonText: z.string().trim().max(2000, 'Please keep the details under 2000 characters').optional(),
    }),
});

const resolveValidationSchema = z.object({
    body: z.object({ resolutionNotes: z.string().trim().max(1000).optional() }),
});

const blockValidationSchema = z.object({
    body: z.object({ reason: z.string().trim().max(500).optional() }),
});

/*  Public: used by the website report page (recipient has no account) */
router.get('/context/:token', publicReadLimiter, ReportController.getReportContext);
router.post('/', publicSubmitLimiter, validateRequest(submitReportValidationSchema), ReportController.submitReport);

/*  Admin dashboard                                                     */
router.get('/', adminOnly, ReportController.getAdminReports);
router.get('/stats', adminOnly, ReportController.getAdminReportStats);
router.patch('/:id/resolve', adminOnly, validateRequest(resolveValidationSchema), ReportController.resolveReport);
router.patch('/:id/block-sender', adminOnly, validateRequest(blockValidationSchema), ReportController.blockReportedSender);

export const reportRoutes = router;
export default reportRoutes;
