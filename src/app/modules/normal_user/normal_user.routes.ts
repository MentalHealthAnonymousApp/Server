import express from 'express';
import { z } from 'zod';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import NormalUserController from './normal_user.controller';
import { USER_ROLE } from '../user/user.constant';

const router = express.Router();
const adminOnly = auth(USER_ROLE.admin, USER_ROLE.superAdmin);

const setBlockedValidationSchema = z.object({
  body: z.object({
    blocked: z.boolean({ required_error: 'blocked (true/false) is required' }),
    reason: z.string().trim().max(500).optional(),
  }),
});

/*  Admin dashboard (static paths before '/:id')                        */
router.get('/', adminOnly, NormalUserController.getAdminUsers);
router.get('/stats', adminOnly, NormalUserController.getAdminUserStats);
router.patch(
  '/:id/block',
  adminOnly,
  validateRequest(setBlockedValidationSchema),
  NormalUserController.setUserBlocked,
);
router.delete('/:id', adminOnly, NormalUserController.deleteUserByAdmin);

router.get('/:id', adminOnly, NormalUserController.getSingleNormalUserProfile);

export const normalUserRoutes = router;
