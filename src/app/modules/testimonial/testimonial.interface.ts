import { Types } from 'mongoose';

export interface ITestimonial {
    user: Types.ObjectId;
    details: string;
    rating: number;
}
