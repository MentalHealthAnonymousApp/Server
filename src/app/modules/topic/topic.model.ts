import { Schema, model } from 'mongoose';
import { TopicDocument, TopicModel } from './topic.interface';
import { TOPIC_TONES } from './topic.constant';


const topicSchema = new Schema<TopicDocument, TopicModel>(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        shortDescription: {
            type: String,
            required: true,
            trim: true,
        },


        tone: {
            type: String,
            enum: TOPIC_TONES,
            default: 'sky',
        },
        icon: {
            type: String,
            default: 'heart',
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

export const Topic = model<TopicDocument, TopicModel>('Topic', topicSchema);
export default Topic;

