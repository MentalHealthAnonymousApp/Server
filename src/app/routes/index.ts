import { Router } from 'express';
import { AdminRoutes } from '../modules/admin/admin.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { fileUploadRoutes } from '../modules/file-upload/file-upload.routes';
import { legalInfoRoutes } from '../modules/legal_info/legal_info.routes';
import { ManageRoutes } from '../modules/manage-web/manage.routes';
import { notificationRoutes } from '../modules/notification/notification.routes';
import { superAdminRoutes } from '../modules/superAdmin/superAdmin.routes';
import { supportRoutes } from '../modules/support/support.routes';
import { userRoutes } from '../modules/user/user.routes';
import { topicRoutes } from '../modules/topic/topic.routes';
import { resourceRoutes } from '../modules/resource/resource.routes';
import { communityRoutes } from '../modules/community/community.routes';
import { messageRoutes } from '../modules/message/message.routes';
import { packagePurchaseRoutes } from '../modules/package_purchase/package_purchase.routes';
import { reportRoutes } from '../modules/report/report.routes';
import { normalUserRoutes } from '../modules/normal_user/normal_user.routes';

const router = Router();

const moduleRoutes = [
    {
        path: '/auth',
        router: authRoutes,
    },
    {
        path: '/user',
        router: userRoutes,
    },
    {
        path: '/topic',
        router: topicRoutes,
    },
    {
        path: '/resource',
        router: resourceRoutes,
    },
    {
        path: '/community',
        router: communityRoutes,
    },
    {
        path: '/message',
        router: messageRoutes,
    },
    {
        path: '/report',
        router: reportRoutes,
    },
    {
        path: '/normal-user',
        router: normalUserRoutes,
    },
    {
        path: '/package-purchase',
        router: packagePurchaseRoutes,
    },
    {
        path: '/manage',
        router: ManageRoutes,
    },
    {
        path: '/notification',
        router: notificationRoutes,
    },
    {
        path: '/super-admin',
        router: superAdminRoutes,
    },
    {
        path: '/file',
        router: fileUploadRoutes,
    },
    {
        path: '/admin',
        router: AdminRoutes,
    },
    {
        path: '/support',
        router: supportRoutes,
    },
    {
        path: '/legal-info',
        router: legalInfoRoutes,
    },
];

moduleRoutes.forEach((route) => router.use(route.path, route.router));

export default router;
