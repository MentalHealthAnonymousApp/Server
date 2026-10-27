import express from 'express';
import auth from '../../middlewares/auth';
import NormalUserController from './normal_user.controller';
import { USER_ROLE } from '../user/user.constant';

const router = express.Router();



router.get('/', auth(USER_ROLE.admin), NormalUserController.getAllNormalUsers);

router.get(
  '/:id',
  auth(USER_ROLE.admin, USER_ROLE.user),
  NormalUserController.getSingleNormalUserProfile,
);
export const normalUserRoutes = router;
