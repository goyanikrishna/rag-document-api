import multer from 'multer';
import path from 'path';
import fs from 'fs';
import httpStatus from 'http-status';
// config
import { env, UPLOAD_DIR } from '@/config/env';
// common
import APIError from '@/common/errors/api-error';
import { AllowedMimeTypes, AllowedFileExtensions } from '@/common/enums/file-type.enum';

// Ensure the local uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const cleanOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${uniqueSuffix}-${cleanOriginalName}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimetypes: string[] = Object.values(AllowedMimeTypes);
  const allowedExtensions: string[] = Object.values(AllowedFileExtensions);

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimetypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new APIError(
        `Invalid file type: "${file.originalname}". Only PDF (.pdf), DOCX (.docx, .doc), and Text (.txt) documents are allowed.`,
        httpStatus.BAD_REQUEST as number,
        true,
      ),
    );
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE,
  },
});
