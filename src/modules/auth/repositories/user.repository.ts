import { User } from '@prisma/client';
import httpStatus from 'http-status';
import { logger } from '@/config/logger';
import { prisma } from '@/database/client';
import APIError from '@/common/errors/api-error';
import { ICreateUserInput } from '@/modules/auth/interfaces/auth.interface';

async function findByEmail(email: string): Promise<User | null> {
  try {
    return await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  } catch (error: any) {
    logger.error(`Database Error finding user by email: ${error.message}`);
    throw new APIError(
      `Failed to fetch user: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

async function findById(id: string): Promise<User | null> {
  try {
    return await prisma.user.findUnique({
      where: { id },
    });
  } catch (error: any) {
    logger.error(`Database Error finding user by id: ${error.message}`);
    throw new APIError(
      `Failed to fetch user: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

async function create(data: ICreateUserInput): Promise<User> {
  try {
    return await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: data.passwordHash,
      },
    });
  } catch (error: any) {
    logger.error(`Database Error creating user: ${error.message}`);
    throw new APIError(
      `Failed to create user: ${error.message}`,
      httpStatus.INTERNAL_SERVER_ERROR as number,
      false,
    );
  }
}

export default {
  findByEmail,
  findById,
  create,
};
