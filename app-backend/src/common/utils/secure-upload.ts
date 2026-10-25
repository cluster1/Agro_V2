import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { closeSync, openSync, readSync, unlinkSync } from 'fs';

type Kind = 'jpg' | 'png' | 'gif' | 'webp' | 'mp4' | 'webm';

// Extension is derived from the declared MIME type, never from the client filename.
const MIME_TO_EXT: Record<string, Kind> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function matchesMagic(kind: Kind, b: Buffer): boolean {
  const ascii = (start: number, end: number) => b.toString('latin1', start, end);
  switch (kind) {
    case 'jpg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'png':
      return b[0] === 0x89 && ascii(1, 4) === 'PNG';
    case 'gif':
      return ascii(0, 4) === 'GIF8';
    case 'webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    case 'mp4':
      return ascii(4, 8) === 'ftyp';
    case 'webm':
      return b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  }
}

export function secureStorage(destination: string, prefix = '') {
  return diskStorage({
    destination,
    filename: (_req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype];
      if (!ext) return cb(new BadRequestException('Unsupported file type'), '');
      cb(null, `${prefix}${randomBytes(16).toString('hex')}.${ext}`);
    },
  });
}

export function secureFileFilter(allowedMimes: string[]) {
  return (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new BadRequestException('Unsupported file type'), false);
    }
    cb(null, true);
  };
}

export const IMAGE_ONLY = IMAGE_MIMES;
export const IMAGE_AND_VIDEO = Object.keys(MIME_TO_EXT);

/**
 * Verifies the saved file's leading bytes match its declared type. Deletes the
 * file and throws if not, so a spoofed Content-Type cannot land on disk.
 */
export function assertUploadedFile(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) throw new BadRequestException('No file uploaded');
  const kind = MIME_TO_EXT[file.mimetype];
  const header = Buffer.alloc(12);
  let ok = false;
  try {
    const fd = openSync(file.path, 'r');
    try {
      readSync(fd, header, 0, 12, 0);
    } finally {
      closeSync(fd);
    }
    ok = !!kind && matchesMagic(kind, header);
  } catch {
    ok = false;
  }
  if (!ok) {
    try {
      unlinkSync(file.path);
    } catch {
      /* already gone */
    }
    throw new BadRequestException('File content does not match its type');
  }
  return file;
}
