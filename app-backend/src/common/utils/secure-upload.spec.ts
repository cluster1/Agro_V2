import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  IMAGE_AND_VIDEO,
  IMAGE_ONLY,
  assertUploadedFile,
  secureFileFilter,
} from './secure-upload';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const GIF = Buffer.from('GIF89a......', 'latin1');
const WEBP = Buffer.from('RIFF....WEBP', 'latin1');
const MP4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);

describe('secure-upload', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'upload-test-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const file = (name: string, mimetype: string, content: Buffer) => {
    const path = join(dir, name);
    writeFileSync(path, content);
    return { path, mimetype, filename: name } as Express.Multer.File;
  };

  describe('assertUploadedFile (magic bytes)', () => {
    it.each([
      ['image/png', PNG],
      ['image/jpeg', JPG],
      ['image/gif', GIF],
      ['image/webp', WEBP],
      ['video/mp4', MP4],
      ['video/webm', WEBM],
    ])('accepts genuine %s content', (mime, bytes) => {
      const f = file('ok.bin', mime, bytes);
      expect(assertUploadedFile(f)).toBe(f);
      expect(existsSync(f.path)).toBe(true);
    });

    it('rejects and deletes HTML disguised as a PNG', () => {
      const f = file('evil.png', 'image/png', Buffer.from('<script>alert(1)</script>'));
      expect(() => assertUploadedFile(f)).toThrow(BadRequestException);
      expect(existsSync(f.path)).toBe(false);
    });

    it('rejects and deletes SVG disguised as a JPEG', () => {
      const f = file('x.jpg', 'image/jpeg', Buffer.from('<svg onload="alert(1)"/>'));
      expect(() => assertUploadedFile(f)).toThrow(BadRequestException);
      expect(existsSync(f.path)).toBe(false);
    });

    it('rejects a real PNG that claims to be a JPEG (type confusion)', () => {
      const f = file('x.jpg', 'image/jpeg', PNG);
      expect(() => assertUploadedFile(f)).toThrow(BadRequestException);
      expect(existsSync(f.path)).toBe(false);
    });

    it('rejects an executable claiming to be an image', () => {
      const f = file('x.png', 'image/png', Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00', 'latin1'));
      expect(() => assertUploadedFile(f)).toThrow(BadRequestException);
    });

    it('rejects an unsupported declared type even if the bytes look like an image', () => {
      const f = file('x.svg', 'image/svg+xml', PNG);
      expect(() => assertUploadedFile(f)).toThrow(BadRequestException);
    });

    it('rejects a missing file', () => {
      expect(() => assertUploadedFile(undefined)).toThrow(BadRequestException);
    });

    it('rejects a file too short to carry a signature', () => {
      const f = file('tiny.png', 'image/png', Buffer.from([0x89]));
      expect(() => assertUploadedFile(f)).toThrow(BadRequestException);
    });
  });

  describe('secureFileFilter', () => {
    const run = (allowed: string[], mimetype: string) => {
      const cb = jest.fn();
      secureFileFilter(allowed)({}, { mimetype } as Express.Multer.File, cb);
      return cb.mock.calls[0];
    };

    it('accepts allowed mime types', () => {
      expect(run(IMAGE_ONLY, 'image/png')).toEqual([null, true]);
      expect(run(IMAGE_AND_VIDEO, 'video/mp4')).toEqual([null, true]);
    });

    it.each(['image/svg+xml', 'text/html', 'application/x-msdownload', 'application/pdf', 'video/mp4'])(
      'rejects %s for logo uploads with a 400 (not a 500)',
      (mime) => {
        const [err, accept] = run(IMAGE_ONLY, mime);
        expect(err).toBeInstanceOf(BadRequestException);
        expect(accept).toBe(false);
      },
    );
  });
});
