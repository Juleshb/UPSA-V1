import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { errors } from '../utils/errors';

const root = path.resolve(process.cwd(), 'uploads');
const pendingDir = path.join(root, 'pending');
const schoolDir = path.join(root, 'schools');

const ALLOWED = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
]);

const STORED_NAME = /^[a-f0-9]{32}\.(pdf|png|jpg)$/;

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
}).single('file');

export function acceptUpload(req: Request, res: Response, next: NextFunction) {
  memoryUpload(req, res, (error: unknown) => {
    if (error) {
      next(errors.unprocessable('FILE_INVALID', 'Attach a PDF, PNG, or JPEG up to 8 MB.'));
      return;
    }
    next();
  });
}

function extensionFor(file: Express.Multer.File) {
  const extension = ALLOWED.get(file.mimetype);
  if (!extension) {
    throw errors.unprocessable('FILE_TYPE_INVALID', 'Attach a PDF, PNG, or JPEG.');
  }
  return extension;
}

function originalName(name: string) {
  const base = path.basename(name).replace(/[^\w.\- ()]+/g, '').slice(0, 120);
  return base || 'document';
}

function storedFileName(extension: string) {
  return `${randomBytes(16).toString('hex')}.${extension}`;
}

export async function savePendingUpload(file: Express.Multer.File | undefined) {
  if (!file) throw errors.unprocessable('FILE_REQUIRED', 'Choose a file to attach.');
  const extension = extensionFor(file);
  const uploadId = storedFileName(extension);
  await fs.mkdir(pendingDir, { recursive: true });
  await fs.writeFile(path.join(pendingDir, uploadId), file.buffer);
  return { uploadId, fileName: originalName(file.originalname) };
}

export async function claimPendingUpload(uploadId: string) {
  if (!STORED_NAME.test(uploadId)) {
    throw errors.unprocessable('UPLOAD_INVALID', 'One of the attached files could not be found. Attach it again.');
  }
  const from = path.join(pendingDir, uploadId);
  try {
    await fs.access(from);
  } catch {
    throw errors.unprocessable('UPLOAD_INVALID', 'One of the attached files could not be found. Attach it again.');
  }
  await fs.mkdir(schoolDir, { recursive: true });
  const storedName = storedFileName(path.extname(uploadId).slice(1));
  await fs.rename(from, path.join(schoolDir, storedName));
  return storedName;
}

export async function saveSchoolUpload(file: Express.Multer.File | undefined) {
  if (!file) throw errors.unprocessable('FILE_REQUIRED', 'Choose a file to attach.');
  const extension = extensionFor(file);
  const storedName = storedFileName(extension);
  await fs.mkdir(schoolDir, { recursive: true });
  await fs.writeFile(path.join(schoolDir, storedName), file.buffer);
  return { storedName, fileName: originalName(file.originalname) };
}

export function schoolUploadPath(storedName: string | null | undefined) {
  if (!storedName || !STORED_NAME.test(storedName)) return null;
  return path.join(schoolDir, storedName);
}

export function uploadContentType(storedName: string) {
  if (storedName.endsWith('.png')) return 'image/png';
  if (storedName.endsWith('.jpg')) return 'image/jpeg';
  return 'application/pdf';
}
