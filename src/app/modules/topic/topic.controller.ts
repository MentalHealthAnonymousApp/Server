import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import TopicServices from './topic.service';

const createTopic = catchAsync(async (req, res) => {
    const result = await TopicServices.createTopicIntoDB(req.body);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: 'Topic created successfully',
        data: result,
    });
});

const getAllTopics = catchAsync(async (req, res) => {
    const result = await TopicServices.getAllTopicsFromDB(req.query);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Topics fetched successfully',
        meta: result.meta,
        data: result.data,
    });
});

const getSingleTopic = catchAsync(async (req, res) => {
    const result = await TopicServices.getSingleTopicFromDB(req.params.id);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Topic fetched successfully',
        data: result,
    });
});

const updateTopic = catchAsync(async (req, res) => {
    const result = await TopicServices.updateTopicIntoDB(req.params.id, req.body);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Topic updated successfully',
        data: result,
    });
});

const deleteTopic = catchAsync(async (req, res) => {
    const result = await TopicServices.deleteTopicFromDB(req.params.id);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Topic deleted successfully',
        data: result,
    });
});

export const TopicController = {
    createTopic,
    getAllTopics,
    getSingleTopic,
    updateTopic,
    deleteTopic,
};

export default TopicController;
