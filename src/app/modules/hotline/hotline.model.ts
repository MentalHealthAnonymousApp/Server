import { Schema, model } from 'mongoose';
import { HotlineDocument, HotlineModel } from './hotline.interface';

const hotlineSchema = new Schema<HotlineDocument, HotlineModel>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        number: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        availability: {
            type: String,
            default: '24/7 · call or text',
        },
        order: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
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

export const Hotline = model<HotlineDocument, HotlineModel>('Hotline', hotlineSchema);
export default Hotline;

