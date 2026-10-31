export const USER_ROLE = {
    user: 'user',
    member: 'member',
    verified_sender: 'verified_sender',
    clinician: 'clinician',
    caregiver: 'caregiver',
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
