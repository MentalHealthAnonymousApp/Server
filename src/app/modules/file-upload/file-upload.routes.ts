import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import fileController from './file-upload.controller';

const router = express.Router();

router.post(
    '/delete-files',
    auth(USER_ROLE.user),
    fileController.deleteFiles
);

export const fileUploadRoutes = router;
