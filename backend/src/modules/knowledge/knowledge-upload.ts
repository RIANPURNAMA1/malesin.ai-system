import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import { createError } from '../../middlewares/error.middleware';
import { AuthRequest } from '../../types/express.d';

/**
 * Upload gambar untuk Knowledge Base.
 *
 * File disimpan di `uploads/knowledge/<companyId>/` dengan nama unik sehingga
 * nama dari client tidak pernah dipakai sebagai path (mencegah path traversal).
 */
export const KNOWLEDGE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const KNOWLEDGE_UPLOAD_MAX_FILES = 5;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

export function knowledgeMediaDir(companyId: string): string {
  return path.join(UPLOADS_ROOT, 'knowledge', companyId);
}

/** Path relatif terhadap folder `uploads`, disimpan di database. */
export function toStoragePath(absolutePath: string): string {
  return path.relative(UPLOADS_ROOT, absolutePath).split(path.sep).join('/');
}

/** URL publik absolut; bisa dioverride lewat PUBLIC_BASE_URL (mis. di balik proxy). */
export function toPublicUrl(req: Request, storagePath: string): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  const base = configured || `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/${storagePath.replace(/^\/+/, '')}`;
}

function sanitizeOriginalName(name: string): string {
  const base = path.basename(name || 'image');
  return base.replace(/[^\w.\- ()]/g, '_').slice(0, 180) || 'image';
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const companyId = (req as AuthRequest).user?.companyId;
      if (!companyId) throw createError('Unauthorized', 401);
      const dir = knowledgeMediaDir(companyId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const ext = MIME_EXTENSIONS[file.mimetype.toLowerCase()];
    // Fallback ke ekstensi aman; fileFilter sudah menolak MIME yang tidak valid.
    cb(null, `${Date.now()}-${randomUUID()}${ext || '.img'}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: KNOWLEDGE_UPLOAD_MAX_BYTES, files: KNOWLEDGE_UPLOAD_MAX_FILES },
  fileFilter: (_req, file, cb: FileFilterCallback) => {
    const mime = file.mimetype.toLowerCase();
    if (!MIME_EXTENSIONS[mime]) {
      return cb(createError('Format gambar harus JPG, JPEG, PNG, WEBP, atau GIF', 400));
    }
    cb(null, true);
  },
});

/** Middleware upload multiple image dengan pesan error yang ramah. */
export function knowledgeImageUpload(req: Request, res: Response, next: NextFunction) {
  upload.array('files', KNOWLEDGE_UPLOAD_MAX_FILES)(req, res, (err: unknown) => {
    if (!err) return next();

    const e = err as { code?: string; message?: string };
    if (e.code === 'LIMIT_FILE_SIZE') {
      return next(createError(`Ukuran gambar maksimal ${KNOWLEDGE_UPLOAD_MAX_BYTES / (1024 * 1024)}MB`, 400));
    }
    if (e.code === 'LIMIT_FILE_COUNT') {
      return next(createError(`Maksimal ${KNOWLEDGE_UPLOAD_MAX_FILES} gambar sekali upload`, 400));
    }
    if (e.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(createError('Field upload tidak dikenal (gunakan "files")', 400));
    }
    return next(e instanceof Error ? e : createError('Upload gagal', 400));
  });
}

/** Cek magic bytes supaya file yang disamarkan sebagai gambar ditolak. */
export function assertImageSignature(filePath: string, mimeType: string): void {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    const mime = mimeType.toLowerCase();
    const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const isPng =
      header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    const isWebp =
      header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
    const isGif = header.toString('ascii', 0, 4) === 'GIF8';

    if (
      (mime === 'image/jpeg' || mime === 'image/jpg') && !isJpeg ||
      mime === 'image/png' && !isPng ||
      mime === 'image/webp' && !isWebp ||
      mime === 'image/gif' && !isGif
    ) {
      throw createError('Isi file tidak cocok dengan tipe gambar yang diizinkan', 400);
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Hapus file media dari disk dengan guard supaya tidak bisa keluar dari folder
 * uploads (path traversal).
 */
export function deleteStoredFile(storagePath: string): void {
  const absolute = path.resolve(UPLOADS_ROOT, storagePath);
  const root = path.resolve(UPLOADS_ROOT) + path.sep;
  if (!absolute.startsWith(root)) return;
  try {
    fs.unlinkSync(absolute);
  } catch {
    /* file mungkin sudah tidak ada */
  }
}

export function storedFileExists(storagePath: string): boolean {
  const absolute = path.resolve(UPLOADS_ROOT, storagePath);
  const root = path.resolve(UPLOADS_ROOT) + path.sep;
  if (!absolute.startsWith(root)) return false;
  return fs.existsSync(absolute);
}

export function fileRecordMeta(file: Express.Multer.File, req: Request) {
  const storagePath = toStoragePath(file.path);
  return {
    filename: sanitizeOriginalName(file.originalname),
    mimeType: file.mimetype.toLowerCase(),
    fileSize: file.size,
    storagePath,
    publicUrl: toPublicUrl(req, storagePath),
  };
}
