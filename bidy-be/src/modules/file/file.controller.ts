import { Response } from 'express';
import { FileService, PRESIGN_TTL_SECONDS } from './file.service.js';
import { apiResponse } from '../../common/util/api-response.js';
import { CustomRequest } from '../user/user.controller.js';
import { logger } from '../../common/util/logger.js';
import { FILE_MESSAGE } from '../../common/messages/file/file.message.js';

/**
 * Where an upload lands in the bucket, keyed by what the caller says it is for.
 *
 * Avatars are deliberately absent: POST /api/v1/users/avatar uploads and attaches
 * in one step, so registering an avatar here would only produce a `files` row no
 * user points at and nothing ever cleans up.
 */
const FOLDER_BY_PURPOSE: Record<string, string> = {
  product: 'products',
  auction: 'auctions',
  category: 'categories',
  review: 'reviews',
  withdrawal_proof: 'withdrawal-proofs',
};

export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * Registers an upload and hands back the id callers attach to a product,
   * category, review or avatar. The URL returned is already presigned so the
   * client can preview the file before committing it to anything.
   */
  upload = async (req: CustomRequest<{ purpose?: string }>, res: Response) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json(apiResponse('fail', FILE_MESSAGE.NO_FILE_PROVIDED));
      }

      const purpose = String(req.body?.purpose ?? 'product');
      const folder = FOLDER_BY_PURPOSE[purpose];
      if (!folder) {
        return res.status(400).json(apiResponse('fail', FILE_MESSAGE.INVALID_PURPOSE));
      }

      const created = await this.fileService.createFromUpload(file, folder, req.idUser);

      return res.status(201).json(
        apiResponse('success', FILE_MESSAGE.UPLOAD_SUCCESS, {
          id: created.id,
          url: await this.fileService.urlOf(created),
          originalName: created.originalName,
          mimeType: created.mimeType,
          sizeBytes: created.sizeBytes,
          expiresIn: PRESIGN_TTL_SECONDS,
        }),
      );
    } catch (error: any) {
      logger.error('Failed to upload file', error, { ip: req.ip });
      return res.status(500).json(apiResponse('error', FILE_MESSAGE.UPLOAD_FAILED));
    }
  };

  /**
   * Re-signs a stored file.
   *
   * The id must exist in `files`, which is what stops a caller from having the
   * server sign an arbitrary key in the bucket — the old key-based endpoint had
   * to check membership by hand, and only ever checked product images.
   *
   * Anonymous callers reach this on purpose, but only for product images: those
   * render on pages any visitor can open, and a visitor whose URL expired has no
   * other way to recover it. Everything else needs a token, so that guessing a
   * file id never yields someone's avatar. `attachUserIfAuthenticated` only makes
   * the identity available — the check below is what enforces it.
   */
  getUrl = async (req: CustomRequest<unknown>, res: Response) => {
    try {
      const file = await this.fileService.findById(String(req.params.id));
      if (!file) {
        return res.status(404).json(apiResponse('fail', FILE_MESSAGE.FILE_NOT_FOUND));
      }

      if (!(await this.fileService.canRead(file.id, req.idUser, req.role))) {
        // 404, not 401/403: telling an unauthorized or anonymous caller that a given
        // id exists but is restricted is itself a disclosure.
        logger.warn('Unauthorized or anonymous presign request for a non-public file', {
          id: file.id,
          userId: req.idUser,
          ip: req.ip,
        });
        return res.status(404).json(apiResponse('fail', FILE_MESSAGE.FILE_NOT_FOUND));
      }

      return res.status(200).json(
        apiResponse('success', FILE_MESSAGE.URL_SUCCESS, {
          id: file.id,
          url: await this.fileService.urlOf(file),
          expiresIn: PRESIGN_TTL_SECONDS,
        }),
      );
    } catch (error: any) {
      logger.error('Failed to presign file', error, { id: req.params.id, ip: req.ip });
      return res.status(500).json(apiResponse('error', FILE_MESSAGE.URL_FAILED));
    }
  };
}
