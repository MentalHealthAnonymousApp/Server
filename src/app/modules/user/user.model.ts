import bcrypt from 'bcrypt';
import { Schema, model } from 'mongoose';
import config from '../../config';
import { USER_ROLE } from './user.constant';
import { TUser, UserModel } from './user.interface';

const userSchema = new Schema<TUser, UserModel>(
    {
        profileId: {
            type: String,
            default: null,
        },
        name: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
        },
        profile_image: {
            type: String,
            default: '',
        },
        address: {
            type: String,
            default: '',
        },
        dateOfBirth: {
            type: Date,
            default: null,
        },
        password: {
            type: String,
        },
        passwordChangedAt: {
            type: Date,
        },
        role: {
            type: String,
            enum: Object.values(USER_ROLE),
            default: USER_ROLE.member,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'blocked', 'suspended', 'in-progress'],
            default: 'active',
        },
        isBlocked: {
            type: Boolean,
            default: false,
        },
        blockedAt: {
            type: Date,
        },
        blockedReason: {
            type: String,
        },
        notes: {
            type: String,
        },
        messagesSentCount: {
            type: Number,
            default: 0,
        },
        reportsReceivedCount: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        verifyCode: {
            type: Number,
        },
        resetCode: {
            type: Number,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        isResetVerified: {
            type: Boolean,
            default: false,
        },
        codeExpireIn: {
            type: Date,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        appleId: {
            type: String,
        },
        googleId: {
            type: String,
        },
        playerIds: { type: [String], default: [] },
        notificationEnabled: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.pre('save', async function (next) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const user = this;
    if (user.password && user.isModified('password')) {
        user.password = await bcrypt.hash(
            user.password,
            Number(config.bcrypt_salt_rounds)
        );
    }
    next();
});

userSchema.post('save', function (doc, next) {
    doc.password = '';
    next();
});

// statics method for check is user exists
userSchema.statics.isUserExists = async function (phoneNumber: string) {
    return await User.findOne({ phoneNumber }).select('+password');
};

// statics method for check password match
userSchema.statics.isPasswordMatched = async function (
    plainPasswords: string,
    hashPassword: string
) {
    return await bcrypt.compare(plainPasswords, hashPassword);
};

userSchema.statics.isJWTIssuedBeforePasswordChange = async function (
    passwordChangeTimeStamp,
    jwtIssuedTimeStamp
) {
    const passwordChangeTime =
        new Date(passwordChangeTimeStamp).getTime() / 1000;

    return passwordChangeTime > jwtIssuedTimeStamp;
};

export const User = model<TUser, UserModel>('User', userSchema);
export default User;
