import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import CommunityController from './community.controller';
import CommunityValidations from './community.validation';

const router = express.Router();
const communityUserAuth = auth(USER_ROLE.user);
const communityModeratorAuth = auth(USER_ROLE.admin, USER_ROLE.superAdmin);
const communityMemberAuth = auth(USER_ROLE.user, USER_ROLE.admin, USER_ROLE.superAdmin);

router.get('/', CommunityController.getAllCommunityPosts);
router.get('/moderation', communityModeratorAuth, CommunityController.getModerationQueue);
router.get('/moderation/:id', communityModeratorAuth, CommunityController.getModerationPost);
router.get('/:id/replies', CommunityController.getCommunityReplies);
router.get('/:id', CommunityController.getSingleCommunityPost);

router.post(
    '/',
    communityUserAuth,
    validateRequest(CommunityValidations.createCommunityPostValidationSchema),
    CommunityController.createCommunityPost
);
router.post('/:id/like', communityUserAuth, CommunityController.toggleCommunityPostLike);
router.post(
    '/:id/replies',
    communityUserAuth,
    validateRequest(CommunityValidations.createCommunityReplyValidationSchema),
    CommunityController.createCommunityReply
);

router.patch(
    '/:id',
    communityUserAuth,
    validateRequest(CommunityValidations.updateCommunityPostValidationSchema),
    CommunityController.updateCommunityPost
);
router.patch(
    '/:id/moderation',
    communityModeratorAuth,
    validateRequest(CommunityValidations.moderateCommunityPostValidationSchema),
    CommunityController.moderateCommunityPost
);

router.delete('/:id', communityMemberAuth, CommunityController.deleteCommunityPost);
router.delete('/:id/replies/:replyId', communityMemberAuth, CommunityController.deleteCommunityReply);

export const communityRoutes = router;
export default communityRoutes;
