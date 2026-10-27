import catchAsync from "../../utilities/catchasync";
import sendResponse from "../../utilities/sendResponse";
import normalUserServices from "./normal_user.service";
import { StatusCodes } from 'http-status-codes';
const getSingleNormalUserProfile = catchAsync(async (req, res) => {
  const result = await normalUserServices.getSingleNormalUserProfile(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile found successfully',
    data: result,
  });
});

const getAllNormalUsers = catchAsync(async (req, res) => {
  const result = await normalUserServices.getAllNormalUsers(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'All normal users fetched successfully',
    data: result,
  });
});

const NormalUserController = {
  getSingleNormalUserProfile,
  getAllNormalUsers,
};
export default NormalUserController;
