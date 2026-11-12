import { Response, NextFunction } from 'express';
import { knowledgeService, KnowledgeMediaDto } from './knowledge.service';
import { success } from '../../utils/response';
import { AuthRequest } from '../../types/express.d';
import { createError } from '../../middlewares/error.middleware';
import { assertImageSignature, deleteStoredFile, fileRecordMeta, toStoragePath } from './knowledge-upload';

function parseStringArray(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(v => String(v ?? '')) : [];
  } catch {
    return [];
  }
}

export class KnowledgeController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await knowledgeService.list(req.user!.companyId, req.params.id);
      success(res, data);
    } catch (err) { next(err); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await knowledgeService.create(req.user!.companyId, req.params.id, req.body);
      success(res, data, 'Knowledge added', 201);
    } catch (err) { next(err); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await knowledgeService.update(req.user!.companyId, req.params.id, req.params.knowledgeId, req.body);
      success(res, data, 'Knowledge updated');
    } catch (err) { next(err); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await knowledgeService.delete(req.user!.companyId, req.params.id, req.params.knowledgeId);
      success(res, null, 'Knowledge deleted');
    } catch (err) { next(err); }
  }

  /** Upload satu/beberapa gambar dan langsung hubungkan ke knowledge. */
  async uploadMedia(req: AuthRequest, res: Response, next: NextFunction) {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    try {
      if (!files.length) throw createError('Pilih minimal satu gambar untuk diupload', 400);

      const altTexts = parseStringArray(req.body?.altTexts);
      const descriptions = parseStringArray(req.body?.descriptions);

      const items: KnowledgeMediaDto[] = files.map((file, i) => {
        assertImageSignature(file.path, file.mimetype);
        return {
          ...fileRecordMeta(file, req),
          altText: altTexts[i] ?? null,
          description: descriptions[i] ?? null,
        };
      });

      const data = await knowledgeService.addMedia(
        req.user!.companyId,
        req.params.id,
        req.params.knowledgeId,
        items
      );
      success(res, data, 'Gambar knowledge berhasil diupload', 201);
    } catch (err) {
      // Jangan tinggalkan file yatim kalau validasi/penyimpanan gagal.
      for (const file of files) {
        if (file.path) deleteStoredFile(toStoragePath(file.path));
      }
      next(err);
    }
  }

  async updateMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await knowledgeService.updateMedia(
        req.user!.companyId,
        req.params.id,
        req.params.knowledgeId,
        req.params.mediaId,
        req.body
      );
      success(res, data, 'Media knowledge updated');
    } catch (err) { next(err); }
  }

  async deleteMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await knowledgeService.deleteMedia(
        req.user!.companyId,
        req.params.id,
        req.params.knowledgeId,
        req.params.mediaId
      );
      success(res, null, 'Media knowledge deleted');
    } catch (err) { next(err); }
  }
}
