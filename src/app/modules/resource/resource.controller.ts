import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import ResourceServices from './resource.service';

const createResource = catchAsync(async (req, res) => {
    const result = await ResourceServices.createResourceIntoDB(req.body);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: 'Resource created successfully',
        data: result,
    });
});

const getAllResources = catchAsync(async (req, res) => {
    const result = await ResourceServices.getAllResourcesFromDB(req.query);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Resources fetched successfully',
        meta: result.meta,
        data: result.data,
    });
});

const getAdminResources = catchAsync(async (req, res) => {
    const result = await ResourceServices.getAllResourcesFromDB(req.query, true);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Resources fetched successfully',
        meta: result.meta,
        data: result.data,
    });
});

const getSingleResource = catchAsync(async (req, res) => {
    const result = await ResourceServices.getSingleResourceFromDB(req.params.id);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Resource fetched successfully',
        data: result,
    });
});

const getAdminResource = catchAsync(async (req, res) => {
    const result = await ResourceServices.getSingleResourceFromDB(req.params.id, true);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Resource fetched successfully',
        data: result,
    });
});

const updateResource = catchAsync(async (req, res) => {
    const result = await ResourceServices.updateResourceIntoDB(req.params.id, req.body);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Resource updated successfully',
        data: result,
    });
});

const deleteResource = catchAsync(async (req, res) => {
    const result = await ResourceServices.deleteResourceFromDB(req.params.id);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Resource deleted successfully',
        data: result,
    });
});

export const ResourceController = {
    createResource,
    getAllResources,
    getAdminResources,
    getSingleResource,
    getAdminResource,
    updateResource,
    deleteResource,
};

export default ResourceController;
