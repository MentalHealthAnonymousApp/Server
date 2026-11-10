import { JwtPayload } from 'jsonwebtoken';
import httpStatus from 'http-status';
import config from '../../config';
import AppError from '../../error/appError';
import { deleteFileFromS3 } from '../../helper/deleteFromS3';
import { registrationSuccessEmail } from '../../mailTemplate/registerSucessEmail';
import sendEmail from '../../utilities/sendEmail';
import Admin from '../admin/admin.model';
import { upsertDevice } from '../device/device.service';
import SuperAdmin from '../superAdmin/superAdmin.model';
import { USER_ROLE } from './user.constant';
import { UpdateUserProfileDTO } from './user.dto';
import { TUserRole } from './user.interface';
import { User } from './user.model';
import { createToken } from './user.utils';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import NormalUser from '../normal_user/normal_user.model';
type RegistrationPayload = {
    userData: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
    };
    password: string;
    confirmPassword: string;
    playerId?: string;
    platform?: 'ios' | 'android' | 'web';
};

const generateVerifyCode = (): number =>
    Math.floor(100000 + Math.random() * 900000);

const createAuthTokens = (user: {
    _id: string;
    profileId?: string | null;
    email: string;
    role: TUserRole;
}) => {
    const jwtPayload = {
        id: user._id.toString(),
        profileId: user.profileId || user._id.toString(),
        email: user.email,
        role: user.role,
    };

    return {
        accessToken: createToken(
            jwtPayload,
            config.jwt_access_secret as string,
            config.jwt_access_expires_in as string
        ),
        refreshToken: createToken(
            jwtPayload,
            config.jwt_refresh_secret as string,
            config.jwt_refresh_expires_in as string
        ),
    };
};

export const registerUser = async (
    payload: RegistrationPayload
) => {
    const {
        userData,
        password,
        confirmPassword,
        playerId,
        platform = 'android',
    } = payload;
    const profileData = userData;

    // validate password
    if (password !== confirmPassword) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Password and confirm password doesn't match"
        );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const session = await mongoose.startSession();

    let user: any;
    let profile: any;
    let verifyCode: number;

    try {
        await session.withTransaction(async () => {
            verifyCode = generateVerifyCode();

            user = await User.findOne({
                email: profileData.email,
            }).session(session);

            if (user?.isVerified) {
                throw new AppError(
                    httpStatus.BAD_REQUEST,
                    'This email already exists'
                );
            }

            if (!user) {
                [user] = await User.create(
                    [
                        {
                            email: profileData.email,
                            phone: profileData.phone,
                            password: hashedPassword,
                            role: 'user',
                            verifyCode,
                            codeExpireIn: new Date(Date.now() + 5 * 60 * 1000),
                            isVerified: false,
                        },
                    ],
                    { session }
                );
            } else {
                user.password = hashedPassword;
                user.role = 'user';
                user.verifyCode = verifyCode;
                user.codeExpireIn = new Date(Date.now() + 5 * 60 * 1000);

                await user.save({ session });
            }

            const profilePayload = {
                ...profileData,
                user: user._id,
            };

                profile = await NormalUser.findOneAndUpdate(
                    { user: user._id },
                    profilePayload,
                    {
                        upsert: true,
                        new: true,
                        session,
                        setDefaultsOnInsert: true,
                    }
                );
            

            user.profileId = profile._id;

            await user.save({ session });
        });

        if (playerId) {
            await upsertDevice(user.profileId.toString(), playerId, platform);
        }

        await sendEmail({
            email: profileData.email,
            subject: 'Activate Your Account',
            html: registrationSuccessEmail(profile.name, verifyCode!),
        });

        return profile;
    } catch (error: any) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            error?.message || 'Service unavailable'
        );
    } finally {
        session.endSession();
    }
};

const verifyCode = async (email: string, verifyCode: number) => {
    const user = await User.findOne({ email });
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }
    if (!user.codeExpireIn || user.codeExpireIn < new Date()) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Verify code is expired');
    }
    if (verifyCode !== user.verifyCode) {
        throw new AppError(httpStatus.BAD_REQUEST, "Code doesn't match");
    }

    user.isVerified = true;
    user.verifyCode = undefined;
    await user.save();

    const tokenUser = {
        _id: user._id.toString(),
        profileId: user.profileId,
        email: user.email,
        role: user.role,
    };

    return {
        ...createAuthTokens(tokenUser),
        role: user.role,
    };
};

const resendVerifyCode = async (email: string) => {
    const user = await User.findOne({ email });
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    const verifyCode = generateVerifyCode();
    user.verifyCode = verifyCode;
    user.codeExpireIn = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    sendEmail({
        email,
        subject: 'Activate Your Account',
        html: registrationSuccessEmail(user.name || 'User', verifyCode),
    });

    return null;
};

const getMyProfile = async (userData: JwtPayload) => {
    if (userData.role === USER_ROLE.user) {
        return User.findById(userData.id);
    }
    if (userData.role === USER_ROLE.admin) {
        return Admin.findById(userData.profileId).populate('user');
    }
    if (userData.role === USER_ROLE.superAdmin) {
        return SuperAdmin.findById(userData.profileId).populate('user');
    }

    throw new AppError(httpStatus.FORBIDDEN, 'Unsupported user role');
};

const deleteUserAccount = async (userData: JwtPayload, password: string) => {
    const user = await User.findById(userData.id);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }
    if (!(await User.isPasswordMatched(password, user.password))) {
        throw new AppError(httpStatus.FORBIDDEN, 'Password do not match');
    }

    await User.findByIdAndDelete(userData.id);
    return null;
};

const updateUserProfile = async (
    userData: JwtPayload,
    payload: UpdateUserProfileDTO
) => {
    let profile;
    let previousImage: string | undefined;

    if (userData.role === USER_ROLE.user) {
        profile = await User.findById(userData.id);
        previousImage = profile?.profile_image;
        if (!profile) {
            throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
        }
        profile = await User.findByIdAndUpdate(userData.id, payload, {
            new: true,
            runValidators: true,
        });
    } else if (userData.role === USER_ROLE.admin) {
        profile = await Admin.findById(userData.profileId);
        previousImage = profile?.profile_image;
        if (!profile) {
            throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
        }
        profile = await Admin.findByIdAndUpdate(userData.profileId, payload, {
            new: true,
            runValidators: true,
        });
    } else if (userData.role === USER_ROLE.superAdmin) {
        profile = await SuperAdmin.findById(userData.profileId);
        previousImage = profile?.profile_image;
        if (!profile) {
            throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
        }
        profile = await SuperAdmin.findByIdAndUpdate(
            userData.profileId,
            payload,
            { new: true, runValidators: true }
        );
    } else {
        throw new AppError(httpStatus.FORBIDDEN, 'Unsupported user role');
    }

    if (payload.profile_image && previousImage) {
        await deleteFileFromS3(previousImage);
    }

    return profile;
};

const changeUserStatus = async (id: string) => {
    const user = await User.findById(id);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    return User.findByIdAndUpdate(
        id,
        { isBlocked: !user.isBlocked },
        { new: true, runValidators: true }
    );
};

const userServices = {
    registerUser,
    verifyCode,
    resendVerifyCode,
    getMyProfile,
    changeUserStatus,
    deleteUserAccount,
    updateUserProfile,
};

export default userServices;
