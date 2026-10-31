import { Schema, model } from 'mongoose';
import { ReportDocument, ReportModel } from './report.interface';
import { REPORT_REASONS, REPORT_STATUS } from './report.constant';
import { DELIVERY_CHANNELS } from '../message/message.constant';
import { TOPIC_TONES } from '../topic/topic.constant';

const reportSchema = new Schema<ReportDocument, ReportModel>(
    {
        messageId: {
            type: Schema.Types.ObjectId,
            ref: 'Message',
            index: true,
        },
        reportedUserId: {
            type: Schema.Types.ObjectId,
            ref: 'NormalUser',
            index: true,
        },
        reportedPersonName: {
            type: String,
            required: true,
            trim: true,
        },
        reportedPersonContact: {
            type: String,
            required: true,
            trim: true,
        },
        reportedByContact: {
            type: String,
            required: true,
            trim: true,
        },
        reportedByChannel: {
            type: String,
            enum: DELIVERY_CHANNELS,
            required: true,
        },
        topicTitle: {
            type: String,
            required: true,
        },
        tone: {
            type: String,
            enum: TOPIC_TONES,
        },
        reasonCategory: {
            type: String,
            enum: REPORT_REASONS,
            required: true,
            index: true,
        },
        reasonText: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: REPORT_STATUS,
            default: 'new',
            index: true,
        },
        resolutionNotes: {
            type: String,
        },
        resolvedAt: {
            type: Date,
        },
        resolvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

export const Report = model<ReportDocument, ReportModel>('Report', reportSchema);
export default Report;

