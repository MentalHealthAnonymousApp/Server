import { Model, Document } from 'mongoose';

export type TTopicTone = 'sky' | 'lavender' | 'sand' | 'blush' | 'mist';

export interface IPacketItem {
    id: string;
    label: string;
}

export interface ITopic {
    slug: string;
    name: string;
    shortDescription: string;
    tone: TTopicTone;
    icon: string;
    isDeleted: boolean;
}

export type TopicDocument = ITopic & Document;

export type TopicModel = Model<TopicDocument>;

