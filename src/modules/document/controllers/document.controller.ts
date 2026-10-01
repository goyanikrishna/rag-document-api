import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
// common
import APIError from '@/common/errors/api-error';
import { ErrMessages, SuccessMessages } from '@/common/constants/app-messages';
import { ErrorCodes } from '@/common/constants/error-codes';
// modules
import documentService from '@/modules/document/services/document.service';

/**
 * Handles document uploading and triggers the vector parsing/ingestion pipeline.
 */
async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new APIError(
        ErrMessages.noFileProvided,
        httpStatus.BAD_REQUEST as number,
        true,
        ErrorCodes.NO_FILE_PROVIDED,
      );
    }

    // req.user is guaranteed by authenticateUser middleware
    const userId = req.user!.id;
    const document = await documentService.uploadAndProcess(req.file, userId);

    res.status(201).json({
      success: true,
      status: 201,
      message: SuccessMessages.documentUploaded,
      data: {
        id: document.id,
        user_id: document.userId,
        original_name: document.originalName,
        filename: document.filename,
        mime_type: document.mimeType,
        size: document.size,
        status: document.status,
        processed_at: document.processedAt,
        error_message: document.errorMessage,
        uploaded_at: document.uploadedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves metadata list of all documents belonging to the authenticated user with pagination, search, and sorting.
 */
async function getDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // req.user is guaranteed by authenticateUser middleware
    const userId = req.user!.id;
    const { page, limit, search, sort, order } = req.query;

    const result = await documentService.getAllDocuments(userId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search ? String(search) : undefined,
      sort: sort ? (String(sort) as any) : undefined,
      order: order ? (String(order) as any) : undefined,
    });

    const mappedDocs = result.items.map((doc) => ({
      id: doc.id,
      user_id: doc.userId,
      original_name: doc.originalName,
      filename: doc.filename,
      mime_type: doc.mimeType,
      size: doc.size,
      status: doc.status,
      processed_at: doc.processedAt,
      error_message: doc.errorMessage,
      uploaded_at: doc.uploadedAt,
    }));

    res.status(200).json({
      success: true,
      status: 200,
      message: SuccessMessages.documentsRetrieved,
      data: {
        documents: mappedDocs,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves metadata of a single document by ID.
 * Enforces that the document belongs to the authenticated user.
 */
async function getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Ownership is enforced inside getDocumentById (throws 403 if not owner)
    const document = await documentService.getDocumentById(id, userId);

    res.status(200).json({
      success: true,
      status: 200,
      message: SuccessMessages.documentRetrieved,
      data: {
        id: document.id,
        user_id: document.userId,
        original_name: document.originalName,
        filename: document.filename,
        mime_type: document.mimeType,
        size: document.size,
        status: document.status,
        processed_at: document.processedAt,
        error_message: document.errorMessage,
        uploaded_at: document.uploadedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes a document by ID and removes its local file.
 * Enforces that the document belongs to the authenticated user.
 */
async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Ownership is enforced inside deleteDocument (throws 403 if not owner)
    await documentService.deleteDocument(id, userId);

    res.status(200).json({
      success: true,
      status: 200,
      message: SuccessMessages.documentDeleted,
      data: null,
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
