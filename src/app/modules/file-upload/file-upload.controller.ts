/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { deleteFileFromS3 } from '../../helper/deleteFromS3';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';

const deleteFiles = catchAsync(async (req, res) => {
    const files = await req.body.files;
    console.log('Start delete files');
    await Promise.all(files.map((file: any) => deleteFileFromS3(file)));
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Files deleted successfully',
        data: null,
    });
});

const fileController = {
    deleteFiles,
};
export default fileController;
