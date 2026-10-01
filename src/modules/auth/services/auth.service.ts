import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import httpStatus from 'http-status';
import { env } from '@/config/env';
import APIError from '@/common/errors/api-error';
import { ErrMessages } from '@/common/constants/app-messages';
import { ErrorCodes } from '@/common/constants/error-codes';
import userRepository from '../repositories/user.repository';
import {
  IRegisterInput,
  ILoginInput,
  IAuthResponse,
} from '@/modules/auth/interfaces/auth.interface';

function generateToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
}

async function register(input: IRegisterInput): Promise<IAuthResponse> {
  const existingUser = await userRepository.findByEmail(input.email);
  if (existingUser) {
    throw new APIError(
      ErrMessages.emailAlreadyExists,
      httpStatus.CONFLICT as number,
      true,
      ErrorCodes.EMAIL_ALREADY_EXISTS,
    );
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(input.password, saltRounds);

  const user = await userRepository.create({
    name: input.name,
    email: input.email,
    passwordHash,
  });

  const token = generateToken(user.id, user.email);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.createdAt,
    },
    token,
  };
}

async function login(input: ILoginInput): Promise<IAuthResponse> {
  const user = await userRepository.findByEmail(input.email);
  if (!user) {
    throw new APIError(
      ErrMessages.invalidCredentials,
      httpStatus.UNAUTHORIZED as number,
      true,
      ErrorCodes.INVALID_CREDENTIALS,
    );
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);
  if (!isPasswordValid) {
    throw new APIError(
      ErrMessages.invalidCredentials,
      httpStatus.UNAUTHORIZED as number,
      true,
      ErrorCodes.INVALID_CREDENTIALS,
    );
  }

  const token = generateToken(user.id, user.email);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.createdAt,
    },
    token,
  };
}

export default {
  register,
  login,
};
