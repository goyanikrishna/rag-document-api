import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';

// Load environment variables from .env file
dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().integer().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  GEMINI_API_KEY: Joi.string().required(),
  GEMINI_MODEL: Joi.string().required(),
  GEMINI_EMBEDDING_MODEL: Joi.string().required(),
  UPLOAD_PATH: Joi.string().default('uploads'),
  MAX_UPLOAD_SIZE: Joi.number().integer().default(20971520), // 20MB in bytes
  CHUNK_SIZE: Joi.number().integer().default(1000),
  CHUNK_OVERLAP: Joi.number().integer().default(200),
  TOP_K_RESULTS: Joi.number().integer().default(5),
  MIN_SIMILARITY_THRESHOLD: Joi.number().min(0).max(1).default(0.55),
  // JWT_SECRET is required — no default is allowed to prevent insecure deployments.
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env, { abortEarly: false });

if (error) {
  console.error('❌ Invalid environment variables configuration:');
  console.error(error.message);
  process.exit(1);
}

export const env = {
  NODE_ENV: envVars.NODE_ENV as 'development' | 'production' | 'test',
  PORT: envVars.PORT as number,
  DATABASE_URL: envVars.DATABASE_URL as string,
  GEMINI_API_KEY: envVars.GEMINI_API_KEY as string,
  GEMINI_MODEL: envVars.GEMINI_MODEL as string,
  GEMINI_EMBEDDING_MODEL: envVars.GEMINI_EMBEDDING_MODEL as string,
  UPLOAD_PATH: envVars.UPLOAD_PATH as string,
  MAX_UPLOAD_SIZE: envVars.MAX_UPLOAD_SIZE as number,
  CHUNK_SIZE: envVars.CHUNK_SIZE as number,
  CHUNK_OVERLAP: envVars.CHUNK_OVERLAP as number,
  TOP_K_RESULTS: envVars.TOP_K_RESULTS as number,
  MIN_SIMILARITY_THRESHOLD: envVars.MIN_SIMILARITY_THRESHOLD as number,
  JWT_SECRET: envVars.JWT_SECRET as string,
  JWT_EXPIRES_IN: envVars.JWT_EXPIRES_IN as string,
};

// Resolve upload path to an absolute path
export const UPLOAD_DIR = path.resolve(env.UPLOAD_PATH);
