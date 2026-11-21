import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import ReportServices from './report.service';

const getReportContext = catchAsync(async (req, res) => {
    const result = await ReportServices.getReportContext(req.params.token);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Report link is valid',
        data: result,
    });
});

const submitReport = catchAsync(async (req, res) => {
    const result = await ReportServices.submitReport(req.body);
    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: 'Thank you. Your report was submitted and our team will review it.',
        data: result,
    });
});

const getAdminReports = catchAsync(async (req, res) => {
    const result = await ReportServices.getAdminReports(req.query);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Reports fetched successfully',
        meta: result.meta,
        data: result.data,
    });
});

const getAdminReportStats = catchAsync(async (_req, res) => {
    const result = await ReportServices.getAdminReportStats();
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Report stats fetched successfully',
        data: result,
    });
});

const resolveReport = catchAsync(async (req, res) => {
    const result = await ReportServices.resolveReport(req.params.id, req.body.resolutionNotes, req.user?.profileId);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Report resolved',
        data: result,
    });
});

const blockReportedSender = catchAsync(async (req, res) => {
    const result = await ReportServices.blockReportedSender(req.params.id, req.body.reason, req.user?.profileId);
    const extras = [
        result.resolvedReports ? `${result.resolvedReports} open report(s) resolved` : '',
        result.rejectedPendingMessages ? `${result.rejectedPendingMessages} pending message(s) rejected` : '',
    ].filter(Boolean);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: `Sender blocked${extras.length ? ` · ${extras.join(' · ')}` : ''}`,
        data: result,
    });
});

const ReportController = {
    getReportContext,
    submitReport,
    getAdminReports,
    getAdminReportStats,
    resolveReport,
    blockReportedSender,
};

export default ReportController;
