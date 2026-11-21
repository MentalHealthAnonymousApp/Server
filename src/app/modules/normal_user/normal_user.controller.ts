import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import NormalUserServices from './normal_user.service';

const getSingleNormalUserProfile = catchAsync(async (req, res) => {
  const result = await NormalUserServices.getSingleNormalUserProfile(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile found successfully',
    data: result,
  });
});

const getAdminUsers = catchAsync(async (req, res) => {
  const result = await NormalUserServices.getAdminUsers(req.query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Users fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getAdminUserStats = catchAsync(async (_req, res) => {
  const result = await NormalUserServices.getAdminUserStats();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User stats fetched successfully',
    data: result,
  });
});

const setUserBlocked = catchAsync(async (req, res) => {
  const { blocked, reason } = req.body as { blocked: boolean; reason?: string };
  const result = await NormalUserServices.setUserBlocked(req.params.id, blocked, reason);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: blocked
      ? `User blocked${result.rejectedPendingMessages ? ` and ${result.rejectedPendingMessages} pending message(s) rejected` : ''}`
      : 'User unblocked',
    data: result,
  });
});

const deleteUserByAdmin = catchAsync(async (req, res) => {
  await NormalUserServices.deleteUserByAdmin(req.params.id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'User deleted',
    data: null,
  });
});

const NormalUserController = {
  getSingleNormalUserProfile,
  getAdminUsers,
  getAdminUserStats,
  setUserBlocked,
  deleteUserByAdmin,
};
export default NormalUserController;
