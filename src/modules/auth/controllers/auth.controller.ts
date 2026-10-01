import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import authService from '../services/auth.service';
import { SuccessMessages } from '@/common/constants/app-messages';

async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body);
    res.status(httpStatus.CREATED as number).json({
      success: true,
      status: httpStatus.CREATED,
      message: SuccessMessages.userRegistered,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.status(httpStatus.OK as number).json({
      success: true,
      status: httpStatus.OK,
      message: SuccessMessages.loginSuccessful,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const result = await authService.getMe(userId);
    res.status(httpStatus.OK as number).json({
      success: true,
      status: httpStatus.OK,
      message: SuccessMessages.profileRetrieved,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  register,
  login,
  getMe,
};
