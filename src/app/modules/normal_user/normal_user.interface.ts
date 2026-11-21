/* eslint-disable no-unused-vars */
import { Types, Document, Model } from 'mongoose';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export type TNormalUserRole = 'member' | 'verified_sender' | 'clinician' | 'caregiver';
export type TNormalUserStatus = 'active' | 'blocked' | 'suspended';

export interface INormalUser {
  user: Types.ObjectId; // Ref to auth User
  profile_image?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: Date;
  role: TNormalUserRole;
  status: TNormalUserStatus;
  isBlocked: boolean;
  blockedAt?: Date;
  blockedReason?: string;
  notes?: string;
  messagesSentCount: number;
  reportsReceivedCount: number;
  lastActiveAt?: Date;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type NormalUserDocument = INormalUser & Document;
export type NormalUserModel = Model<NormalUserDocument>;
