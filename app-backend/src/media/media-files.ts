import { Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, resolve, sep } from 'path';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');

const logger = new Logger('MediaFiles');

/**
 * Best-effort delete of an uploaded file. Only unlinks paths that resolve inside
 * the uploads directory (path-traversal guard). Never throws: a missing file is
 * ignored and other fs errors are logged.
 */
export async function safeUnlinkUpload(filePath: string | null | undefined): Promise<void> {
  if (!filePath) return;
  const root = resolve(UPLOADS_DIR);
  const target = resolve(process.cwd(), filePath);
  if (!target.startsWith(root + sep)) {
    logger.warn(`Refusing to delete file outside uploads directory: ${filePath}`);
    return;
  }
  try {
    await fs.unlink(target);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      logger.error(`Failed to delete file ${target}: ${error?.message}`);
    }
  }
}
