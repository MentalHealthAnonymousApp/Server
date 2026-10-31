import { Types, Model, Document } from 'mongoose';
import { TDeliveryChannel } from '../message/message.interface';
import { TTopicTone } from '../topic/topic.interface';

export type TReportReasonCategory =
    | 'harassment'
    | 'unsolicited'
    | 'distressing'
    | 'wrong_number'
    | 'spam'
    | 'other';

export type TReportStatus = 'new' | 'resolved';

export interface IReport {
    messageId?: Types.ObjectId;
    reportedUserId?: Types.ObjectId;
    reportedPersonName: string;
    reportedPersonContact: string;
    reportedByContact: string;
    reportedByChannel: TDeliveryChannel;
    topicTitle: string;
    tone?: TTopicTone;
    reasonCategory: TReportReasonCategory;
    reasonText: string;
    status: TReportStatus;
    resolutionNotes?: string;
    resolvedAt?: Date;
    resolvedBy?: Types.ObjectId;
    isDeleted: boolean;
}

export type ReportDocument = IReport & Document;
export type ReportModel = Model<ReportDocument>;

