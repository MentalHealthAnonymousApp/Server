import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import ResourceController from './resource.controller';
import ResourceValidations from './resource.validation';

const router = express.Router();

router.get(
    '/admin',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    ResourceController.getAdminResources
);
router.get(
    '/admin/:id',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    ResourceController.getAdminResource
);
router.get('/', ResourceController.getAllResources);
router.get('/:id', ResourceController.getSingleResource);

router.post(
    '/',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    validateRequest(ResourceValidations.createResourceValidationSchema),
    ResourceController.createResource
);

router.patch(
    '/:id',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    validateRequest(ResourceValidations.updateResourceValidationSchema),
    ResourceController.updateResource
);

router.delete(
    '/:id',
    auth(USER_ROLE.admin, USER_ROLE.superAdmin),
    ResourceController.deleteResource
);

export const resourceRoutes = router;
export default resourceRoutes;
