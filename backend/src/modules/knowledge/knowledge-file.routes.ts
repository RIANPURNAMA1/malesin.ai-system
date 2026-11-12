import fs from 'fs';
import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { createError } from '../../middlewares/error.middleware';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { assertImageSignature, fileRecordMeta, knowledgeImageUpload } from './knowledge-upload';

/**
 * Upload gambar lepas untuk dijadikan link URL. URL ini bisa ditempel di isi
 * Knowledge atau Pesan Sambutan; AI akan mengirimnya sebagai gambar ke chat.
 * Tidak terikat ke agent tertentu, jadi bisa dipakai juga saat membuat agent baru.
 */
const router = Router();

router.post(
  '/',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  knowledgeImageUpload,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    try {
      if (!files.length) throw createError('Pilih minimal satu gambar', 400);
      files.forEach(f => assertImageSignature(f.path, f.mimetype));
      success(res, files.map(f => {
        const meta = fileRecordMeta(f, req);
        return { filename: meta.filename, url: meta.publicUrl };
      }), 'File diunggah');
    } catch (err) {
      files.forEach(f => fs.unlink(f.path, () => undefined));
      next(err);
    }
  }
);

export default router;
