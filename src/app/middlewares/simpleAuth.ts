/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import config from '../config';
import Admin from '../modules/admin/admin.model';
import SuperAdmin from '../modules/superAdmin/superAdmin.model';
import { USER_ROLE } from '../modules/user/user.constant';
import { User } from '../modules/user/user.model';

const simpleAuth = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        let token = req.headers.authorization;
        if (!token) return next();

        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
        }

        let decoded: JwtPayload | null;
        try {
            decoded = jwt.verify(
                token,
                config.jwt_access_secret as string
            ) as JwtPayload;
        } catch (err: any) {
            decoded =
                err.name === 'TokenExpiredError'
                    ? (jwt.decode(token) as JwtPayload | null)
                    : null;
        }

        if (!decoded?.id) return next();

        let profileId: string | undefined;
        let accountUser: any;

        if (decoded.role === USER_ROLE.user) {
            accountUser = await User.findById(decoded.id);
            profileId = accountUser?._id.toString();
        } else if (decoded.role === USER_ROLE.admin) {
            const profile = await Admin.findOne({ user: decoded.id })
                .select('_id user')
                .populate({
                    path: 'user',
                    select: '_id isDeleted isBlocked isVerified',
                });
            accountUser = profile?.user;
            profileId = profile?._id.toString();
        } else if (decoded.role === USER_ROLE.superAdmin) {
            const profile = await SuperAdmin.findOne({ user: decoded.id })
                .select('_id user')
                .populate({
                    path: 'user',
                    select: '_id isDeleted isBlocked isVerified',
                });
            accountUser = profile?.user;
            profileId = profile?._id.toString();
        }

        if (
            accountUser &&
            !accountUser.isDeleted &&
            !accountUser.isBlocked &&
            accountUser.isVerified &&
            profileId
        ) {
            req.user = decoded;
            req.user.profileId = profileId;
        }

        next();
    } catch (err) {
        console.error(err);
        next();
    }
};

export default simpleAuth;
