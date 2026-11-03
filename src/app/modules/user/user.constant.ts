export const USER_ROLE = {
    user: 'user',
    admin: 'admin',
    superAdmin: 'superAdmin',
} as const;

export const USER_STATUS = {
    active: 'active',
    blocked: 'blocked',
    suspended: 'suspended',
    in_progress: 'in-progress',
} as const;

export const UserStatus = ['active', 'blocked', 'suspended', 'in-progress'];
export const ENUM_GENDER = {
    Male: 'Male',
    Female: 'Female',
    Other: 'Other',
} as const;