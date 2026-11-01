import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../error/appError';
import Topic from './topic.model';
import { ITopic } from './topic.interface';
import { appEventEmitter } from '../../events/eventEmitter';

const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const createTopicIntoDB = async (payload: Partial<ITopic>) => {
    let slug = payload.slug ? generateSlug(payload.slug) : generateSlug(payload.name || '');

    const existingTopic = await Topic.findOne({ slug });
    if (existingTopic) {
        slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }
    payload.slug = slug;

    const result = await Topic.create(payload);

    appEventEmitter.emit('topic:created', {
        topicId: result._id.toString(),
        name: result.name,
    });

    return result;
};

const getAllTopicsFromDB = async (query: Record<string, unknown>) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const searchTerm = (query.searchTerm || query.search || '') as string;
    const sortBy = (query.sortBy as string) || 'createdAt';
    const sortOrder = (query.sortOrder as string)?.toLowerCase() === 'asc' ? 1 : -1;

    const matchConditions: Record<string, unknown>[] = [{ isDeleted: false }];

    if (searchTerm.trim()) {
        const regex = { $regex: searchTerm.trim(), $options: 'i' };
        matchConditions.push({
            $or: [
                { name: regex },
                { shortDescription: regex },
                { slug: regex },
            ],
        });
    }

    const filterableFields = ['tone', 'icon'];
    filterableFields.forEach((field) => {
        if (query[field] !== undefined && query[field] !== '') {
            matchConditions.push({ [field]: query[field] });
        }
    });

    const filter = matchConditions.length > 0 ? { $and: matchConditions } : {};
    const sortStage: Record<string, 1 | -1> = { [sortBy]: sortOrder };

    const aggregation = await Topic.aggregate([
        { $match: filter },
        { $sort: sortStage },
        {
            $facet: {
                data: [{ $skip: skip }, { $limit: limit }],
                total: [{ $count: 'count' }],
            },
        },
    ]);

    const total = aggregation[0]?.total[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
        meta: {
            page,
            limit,
            total,
            totalPages,
        },
        data: aggregation[0]?.data || [],
    };
};

const getSingleTopicFromDB = async (idOrSlug: string) => {
    const identifierCondition: Record<string, unknown>[] = [{ slug: idOrSlug }];

    if (Types.ObjectId.isValid(idOrSlug)) {
        identifierCondition.push({ _id: new Types.ObjectId(idOrSlug) });
    }

    const topic = await Topic.findOne({
        isDeleted: false,
        $or: identifierCondition,
    });

    if (!topic) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Topic not found');
    }

    return topic;
};

const updateTopicIntoDB = async (idOrSlug: string, payload: Partial<ITopic>) => {
    const identifierCondition: Record<string, unknown>[] = [{ slug: idOrSlug }];

    if (Types.ObjectId.isValid(idOrSlug)) {
        identifierCondition.push({ _id: new Types.ObjectId(idOrSlug) });
    }

    if (payload.slug) {
        payload.slug = generateSlug(payload.slug);
    }

    const updated = await Topic.findOneAndUpdate(
        { isDeleted: false, $or: identifierCondition },
        { $set: payload },
        { new: true, runValidators: true }
    );

    if (!updated) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Topic not found to update');
    }

    appEventEmitter.emit('topic:updated', {
        topicId: updated._id.toString(),
        name: updated.name,
    });

    return updated;
};

const deleteTopicFromDB = async (idOrSlug: string) => {
    const identifierCondition: Record<string, unknown>[] = [{ slug: idOrSlug }];

    if (Types.ObjectId.isValid(idOrSlug)) {
        identifierCondition.push({ _id: new Types.ObjectId(idOrSlug) });
    }

    const deleted = await Topic.findOneAndUpdate(
        { isDeleted: false, $or: identifierCondition },
        { $set: { isDeleted: true } },
        { new: true }
    );

    if (!deleted) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Topic not found to delete');
    }

    return deleted;
};

export const TopicServices = {
    createTopicIntoDB,
    getAllTopicsFromDB,
    getSingleTopicFromDB,
    updateTopicIntoDB,
    deleteTopicFromDB,
};

export default TopicServices;
