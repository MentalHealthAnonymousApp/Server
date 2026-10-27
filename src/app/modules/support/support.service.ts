/* eslint-disable @typescript-eslint/no-explicit-any */
import { JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../notification/notification.enum';
import Notification from '../notification/notification.model';
import { ENUM_SUPPORT_STATUS } from './support.enum';
import { ISupport } from './support.interface';
import { Support } from './support.model';

const createSupport = async (
    userData: JwtPayload,
    payload: Pick<ISupport, 'contactReason' | 'message'>
) => {
    const supportData = { ...payload, user: userData.id };

    const result = await Support.create(supportData);
    const data = {
        receiver: 'admin',
        type: ENUM_NOTIFICATION_TYPE.SUPPORT_CREATED,
        title: 'A new support created',
        message: 'A new support created , please resolved it',
        data: {
            entity: NOTIFICATION_ENTITY.SUPPORT,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: result._id,
            meta: {
                userId: userData.id,
                priority: 'high',
            },
        },
    };
    Notification.create(data);
    return result;
};

const getAllSupport = async (query: Record<string, unknown>) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const searchTerm = (query.searchTerm as string) || '';

    const filters: Record<string, unknown> = {};
    Object.keys(query).forEach((key) => {
        if (!['searchTerm', 'page', 'limit'].includes(key)) {
            filters[key] = query[key];
        }
    });

    const pipeline: any[] = [
        {
            $match: filters,
        },

        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'user',
            },
        },
        {
            $addFields: {
                userDetails: {
                    $let: {
                        vars: { account: { $arrayElemAt: ['$user', 0] } },
                        in: {
                            _id: '$$account._id',
                            name: '$$account.name',
                            email: '$$account.email',
                            profile_image: '$$account.profile_image',
                        },
                    },
                },
            },
        },
    ];

    if (searchTerm) {
        pipeline.push({
            $match: {
                $or: [
                    { contactReason: { $regex: searchTerm, $options: 'i' } },
                    { message: { $regex: searchTerm, $options: 'i' } },
                    {
                        'userDetails.name': {
                            $regex: searchTerm,
                            $options: 'i',
                        },
                    },
                    {
                        'userDetails.email': {
                            $regex: searchTerm,
                            $options: 'i',
                        },
                    },
                ],
            },
        });
    }

    pipeline.push({ $project: { user: 0 } });

    pipeline.push({
        $facet: {
            result: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: 'total' }],
        },
    });

    const aggResult = await Support.aggregate(pipeline);

    const result = aggResult?.[0]?.result || [];
    const total = aggResult?.[0]?.totalCount?.[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
        meta: {
            page,
            limit,
            total,
            totalPages,
        },
        result,
    };
};

const updateStatus = async (id: string, status: string) => {
    const validStatuses = Object.values(ENUM_SUPPORT_STATUS);
    if (
        !validStatuses.includes(
            status as (typeof ENUM_SUPPORT_STATUS)[keyof typeof ENUM_SUPPORT_STATUS]
        )
    ) {
        throw new AppError(
            400,
            `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`
        );
    }

    const support = await Support.findByIdAndUpdate(
        id,
        {
            status,
        },
        { new: true, runValidators: true }
    );

    return support;
};

const getSingle = async (id: string) => {
    const pipeline: any[] = [
        {
            $match: {
                _id: new Types.ObjectId(id),
            },
        },

        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'user',
            },
        },
        {
            $addFields: {
                userDetails: {
                    $let: {
                        vars: { account: { $arrayElemAt: ['$user', 0] } },
                        in: {
                            _id: '$$account._id',
                            name: '$$account.name',
                            email: '$$account.email',
                            profile_image: '$$account.profile_image',
                        },
                    },
                },
            },
        },
        { $project: { user: 0 } },
    ];

    const result = await Support.aggregate(pipeline);

    return result[0] || null;
};
const SupportService = {
    createSupport,
    getAllSupport,
    updateStatus,
    getSingle,
};

export default SupportService;
