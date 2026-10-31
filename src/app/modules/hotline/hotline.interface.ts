import { Model, Document } from 'mongoose';

export interface IHotline {
    name: string;
    number: string;
    description: string;
    availability: string;
    order: number;
    isActive: boolean;
    isDeleted: boolean;
}

export type HotlineDocument = IHotline & Document;
export type HotlineModel = Model<HotlineDocument>;

