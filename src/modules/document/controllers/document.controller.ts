import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages, SuccessMessages } from '@/common/constants/app-messages';
// modules
import documentService from '@/modules/document/services/document.service';

/**
 * Handles document uploading and triggers vector parsing/ingestion.
 */
async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new APIError(ErrMessages.noFileProvided, httpStatus.BAD_REQUEST as number, true);
    }

    const document = await documentService.uploadAndProcess(req.file);

    res.status(201).json({
      status: 201,
      message: 'Success',
      data: {
        id: document.id,
        originalName: document.originalName,
        filename: document.filename,
        mimeType: document.mimeType,
        size: document.size,
        uploadedAt: document.uploadedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves metadata list of all uploaded documents.
 */
async function getDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const documents = await documentService.getAllDocuments();

    const mappedDocs = documents.map((doc) => ({
      id: doc.id,
      originalName: doc.originalName,
      filename: doc.filename,
      mimeType: doc.mimeType,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
    }));

    res.status(200).json({
      status: 200,
      message: 'Success',
      data: mappedDocs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves metadata of a single document by ID.
 */
async function getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const document = await documentService.getDocumentById(id);

    res.status(200).json({
      status: 200,
      message: 'Success',
      data: {
        id: document.id,
        originalName: document.originalName,
        filename: document.filename,
        mimeType: document.mimeType,
        size: document.size,
        uploadedAt: document.uploadedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes a document by ID and removes its local file.
 */
async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await documentService.deleteDocument(id);

    res.status(200).json({
      status: 200,
      message: 'Success',
      data: {
        message: SuccessMessages.documentDeleted,
      },
    });
  } catch (error) {
    next(error);
  }
}

export default {
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocument,
};
