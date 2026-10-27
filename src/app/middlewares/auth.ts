/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from '../config';
import AppError from '../error/appError';
import Admin from '../modules/admin/admin.model';
import SuperAdmin from '../modules/superAdmin/superAdmin.model';
import { USER_ROLE } from '../modules/user/user.constant';
import { TUserRole } from '../modules/user/user.interface';
import { User } from '../modules/user/user.model';
import catchAsync from '../utilities/catchasync';

const auth = (...requiredRoles: TUserRole[]) =>
    catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
        const authorization = req.headers.authorization;
        if (!authorization) {
            throw new AppError(
                httpStatus.UNAUTHORIZED,
                'You are not authorized'
            );
        }

        const token = authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : authorization;

        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(
                token,
                config.jwt_access_secret as string
            ) as JwtPayload;
        } catch {
            throw new AppError(httpStatus.UNAUTHORIZED, 'Token is expired');
        }

        const { id, role } = decoded;
        if (!id || !Object.values(USER_ROLE).includes(role)) {
            throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized access');
        }

        let profileId: string | undefined;
        let accountUser: any;

        if (role === USER_ROLE.user) {
            accountUser = await User.findById(id);
            profileId = accountUser?._id.toString();
        } else if (role === USER_ROLE.admin) {
            const profile = await Admin.findOne({ user: id })
                .select('_id user')
                .populate({
                    path: 'user',
                    select: '_id isDeleted isBlocked isVerified isActive',
                });
            profileId = profile?._id.toString();
            accountUser = profile?.user;
        } else {
            const profile = await SuperAdmin.findOne({ user: id })
                .select('_id user')
                .populate({
                    path: 'user',
                    select: '_id isDeleted isBlocked isVerified isActive',
                });
            profileId = profile?._id.toString();
            accountUser = profile?.user;
        }

        if (!accountUser || !profileId) {
            throw new AppError(httpStatus.NOT_FOUND, 'Unauthorized access');
        }
        if (accountUser.isDeleted) {
            throw new AppError(
                httpStatus.UNAUTHORIZED,
                'Unauthorized access'
            );
        }
        if (accountUser.isBlocked) {
            throw new AppError(
                httpStatus.UNAUTHORIZED,
                'Your account is blocked'
            );
        }
        if (!accountUser.isVerified) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                'You are not verified user'
            );
        }
        if (!accountUser.isActive) {
            throw new AppError(
                httpStatus.FORBIDDEN,
                'Your account is inactive, please contact support'
            );
        }
        if (requiredRoles.length && !requiredRoles.includes(role)) {
            throw new AppError(
                httpStatus.UNAUTHORIZED,
                'You are not authorized'
            );
        }

        req.user = decoded;
        req.user.profileId = profileId;
        next();
    });

export default auth;
