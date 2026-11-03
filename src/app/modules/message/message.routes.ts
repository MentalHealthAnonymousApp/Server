import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import MessageController from './message.controller';
import MessageValidations from './message.validation';

const router = express.Router();

/*  User routes                                                         */

// Submit a new message (normal users only)
router.post(
    '/',
    auth(
        USER_ROLE.user,
    ),
    validateRequest(MessageValidations.createMessageValidationSchema),
    MessageController.createMessage
);

// Get own submitted messages
router.get(
    '/my-messages',
    auth(
        USER_ROLE.user,
    ),
    MessageController.getMyMessages
);

/*  Admin routes                                                        */

// Get all messages (with filters)
router.get(
    '/',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    MessageController.getAllMessages
);

// Get single message detail
router.get(
    '/:id',
    auth(USER_ROLE.user, USER_ROLE.admin, USER_ROLE.superAdmin),
    MessageController.getSingleMessage
);

// Approve / reject / update status
router.patch(
    '/:id/status',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    validateRequest(MessageValidations.updateMessageStatusValidationSchema),
    MessageController.updateMessageStatus
);

// Soft-delete a message
router.delete(
    '/:id',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    MessageController.deleteMessage
);

export const messageRoutes = router;
export default messageRoutes;

