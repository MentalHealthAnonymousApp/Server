import { model, Schema } from 'mongoose';
import { NormalUserDocument, NormalUserModel } from './normal_user.interface';

const normalUserSchema = new Schema<NormalUserDocument, NormalUserModel>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    profile_image: { type: String, default: '' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    fullName: { type: String, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    gender: { type: String, enum: ['MALE', 'FEMALE'] },
    dateOfBirth: { type: Date },
    role: {
      type: String,
      enum: ['member', 'verified_sender', 'clinician', 'caregiver'],
      default: 'member',
    },
    status: {
      type: String,
      enum: ['active', 'blocked', 'suspended'],
      default: 'active',
    },
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date },
    blockedReason: { type: String },
    notes: { type: String },
    messagesSentCount: { type: Number, default: 0 },
    reportsReceivedCount: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

normalUserSchema.pre('save', function (next) {
  if (this.firstName || this.lastName) {
    this.fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }
  next();
});

const NormalUser = model<NormalUserDocument, NormalUserModel>('NormalUser', normalUserSchema);
export default NormalUser;
export { NormalUser };
