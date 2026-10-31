import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import TopicController from './topic.controller';
import TopicValidations from './topic.validation';

const router = express.Router();

router.get('/', TopicController.getAllTopics);
router.get('/:id', TopicController.getSingleTopic);

router.post(
    '/',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    validateRequest(TopicValidations.createTopicValidationSchema),
    TopicController.createTopic
);

router.patch(
    '/:id',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    validateRequest(TopicValidations.updateTopicValidationSchema),
    TopicController.updateTopic
);

router.delete(
    '/:id',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    TopicController.deleteTopic
);

export const topicRoutes = router;
export default topicRoutes;
