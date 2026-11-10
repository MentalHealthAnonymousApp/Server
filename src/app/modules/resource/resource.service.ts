import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../error/appError';
import Resource from './resource.model';
import { IResource } from './resource.interface';
import Topic from '../topic/topic.model';
import { appEventEmitter } from '../../events/eventEmitter';

const generateSlug = (title: string): string => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const createResourceIntoDB = async (payload: Partial<IResource>) => {
    if (payload.topic) {
        const topicExists = await Topic.findOne({ _id: payload.topic, isDeleted: false });
        if (!topicExists) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Topic not found');
        }
    }

    let slug = payload.slug ? generateSlug(payload.slug) : generateSlug(payload.title || '');
    const existingResource = await Resource.findOne({ slug });
    if (existingResource) {
        slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }
    payload.slug = slug;

    const result = await Resource.create(payload);

    if (payload.status === 'published') {
        appEventEmitter.emit('resource:published', {
            resourceId: result._id.toString(),
            title: result.title,
        });
    }

    return await result.populate('topic', 'name slug tone icon');
};

const getAllResourcesFromDB = async (
    query: Record<string, unknown>,
    includeUnpublished = false
) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const searchTerm = (query.searchTerm || query.search || '') as string;
    const sortBy = (query.sortBy as string) || 'createdAt';
    const sortOrder = (query.sortOrder as string)?.toLowerCase() === 'asc' ? 1 : -1;

    const matchConditions: Record<string, unknown>[] = [{ isDeleted: false }];

    if (!includeUnpublished) {
        matchConditions.push({ status: 'published' });
    }

    if (searchTerm.trim()) {
        const regex = { $regex: searchTerm.trim(), $options: 'i' };
        matchConditions.push({
            $or: [
                { title: regex },
                { shortDescription: regex },
                { slug: regex },
            ],
        });
    }

    if (query.topic && Types.ObjectId.isValid(query.topic as string)) {
        matchConditions.push({ topic: new Types.ObjectId(query.topic as string) });
    }

    if (includeUnpublished && query.status) {
        matchConditions.push({ status: query.status });
    }

    if (query.isFeatured !== undefined && query.isFeatured !== '') {
        matchConditions.push({ isFeatured: query.isFeatured === 'true' });
    }

    const filter = matchConditions.length > 0 ? { $and: matchConditions } : {};
    const sortStage: Record<string, 1 | -1> = { [sortBy]: sortOrder };

    const aggregation = await Resource.aggregate([
        { $match: filter },
        {
            $lookup: {
                from: 'topics',
                localField: 'topic',
                foreignField: '_id',
                as: 'topic',
            },
        },
        { $unwind: { path: '$topic', preserveNullAndEmptyArrays: true } },
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

const getSingleResourceFromDB = async (idOrSlug: string, includeUnpublished = false) => {
    const identifierCondition: Record<string, unknown>[] = [{ slug: idOrSlug }];

    if (Types.ObjectId.isValid(idOrSlug)) {
        identifierCondition.push({ _id: new Types.ObjectId(idOrSlug) });
    }

    const filter: Record<string, unknown> = {
        isDeleted: false,
        $or: identifierCondition,
    };
    if (!includeUnpublished) {
        filter.status = 'published';
    }

    const resource = await Resource.findOne(filter).populate(
        'topic',
        'name slug tone icon shortDescription'
    );

    if (!resource) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Resource not found');
    }

    return resource;
};

const updateResourceIntoDB = async (idOrSlug: string, payload: Partial<IResource>) => {
    const identifierCondition: Record<string, unknown>[] = [{ slug: idOrSlug }];

    if (Types.ObjectId.isValid(idOrSlug)) {
        identifierCondition.push({ _id: new Types.ObjectId(idOrSlug) });
    }

    if (payload.topic) {
        const topicExists = await Topic.findOne({ _id: payload.topic, isDeleted: false });
        if (!topicExists) {
            throw new AppError(StatusCodes.NOT_FOUND, 'Topic not found');
        }
    }

    if (payload.slug) {
        payload.slug = generateSlug(payload.slug);
    }

    const updated = await Resource.findOneAndUpdate(
        { isDeleted: false, $or: identifierCondition },
        { $set: payload },
        { new: true, runValidators: true }
    ).populate('topic', 'name slug tone icon');

    if (!updated) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Resource not found to update');
    }

    if (payload.status === 'published') {
        appEventEmitter.emit('resource:published', {
            resourceId: updated._id.toString(),
            title: updated.title,
        });
    }

    return updated;
};

const deleteResourceFromDB = async (idOrSlug: string) => {
    const identifierCondition: Record<string, unknown>[] = [{ slug: idOrSlug }];

    if (Types.ObjectId.isValid(idOrSlug)) {
        identifierCondition.push({ _id: new Types.ObjectId(idOrSlug) });
    }

    const deleted = await Resource.findOneAndUpdate(
        { isDeleted: false, $or: identifierCondition },
        { $set: { isDeleted: true } },
        { new: true }
    );

    if (!deleted) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Resource not found to delete');
    }

    return deleted;
};

export const ResourceServices = {
    createResourceIntoDB,
    getAllResourcesFromDB,
    getSingleResourceFromDB,
    updateResourceIntoDB,
    deleteResourceFromDB,
};

export default ResourceServices;
