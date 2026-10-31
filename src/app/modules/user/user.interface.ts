/* eslint-disable no-unused-vars */
import { Model } from 'mongoose';
import { USER_ROLE, USER_STATUS } from './user.constant';

export type TUserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];
export type TUserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export interface TUser {
    _id: string;
    profileId?: string | null;
    name?: string;
    email: string;
    phone?: string;
    profile_image?: string;
    address?: string;
    dateOfBirth?: Date | null;
    password: string;
    passwordChangedAt?: Date;
    role: TUserRole;
    status: TUserStatus;
    isBlocked: boolean;
    blockedAt?: Date;
    blockedReason?: string;
    notes?: string;
    messagesSentCount: number;
    reportsReceivedCount: number;
    verifyCode?: number;
    resetCode?: number;
    isVerified: boolean;
    isResetVerified: boolean;
    codeExpireIn?: Date;
    isActive: boolean;
    isDeleted: boolean;
    appleId?: string;
    googleId?: string;
    playerIds: string[];
    notificationEnabled: boolean;
}

export interface TLoginUser {
    email: string;
    password: string;
}

export interface ILoginWithGoogle {
    name: string;
    email: string;
    profile_image?: string;
    phone?: string;
}

export interface UserModel extends Model<TUser> {
    isUserExists(phoneNumber: string): Promise<TUser>;
    isPasswordMatched(plainPassword: string, hashPassword: string): Promise<TUser>;
    isJWTIssuedBeforePasswordChange(
        passwordChangeTimeStamp: Date,
        jwtIssuedTimeStamp: number
    ): Promise<boolean>;
}
