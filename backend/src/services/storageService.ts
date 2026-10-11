import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import multer from 'multer';
import unzipper from 'unzipper';
import { config } from '../config';
import { logger } from '../logger';
import { AppError } from '../middlewares/errorHandler';

// Ensure upload directory exists
if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

// Multer disk storage setup
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `upload-${uniqueSuffix}${ext}`);
  },
});

// File filter: accept only .zip files
const fileFilter = (_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const isZip =
    file.mimetype === 'application/zip' ||
    file.mimetype === 'application/x-zip-compressed' ||
    file.originalname.toLowerCase().endsWith('.zip');

  if (isZip) {
    cb(null, true);
  } else {
    cb(new AppError('Only .zip archive files are supported', 400, 'INVALID_FILE_TYPE'));
  }
};

export const uploadZipMiddleware = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB maximum zip upload size
  },
  fileFilter,
});

export class StorageService {
  /**
   * Safely extracts a zip archive into a destination directory,
   * with strict path verification to prevent Zip Slip directory traversal vulnerabilities.
   */
  static async extractZip(zipFilePath: string, targetDir: string): Promise<void> {
    logger.info(`Extracting zip ${zipFilePath} into ${targetDir}`);
    await fsp.mkdir(targetDir, { recursive: true });

    const resolvedTarget = path.resolve(targetDir);

    const directory = await unzipper.Open.file(zipFilePath);

    for (const file of directory.files) {
      // Guard against Zip Slip attacks
      const destinationPath = path.resolve(resolvedTarget, file.path);
      if (!destinationPath.startsWith(resolvedTarget)) {
        logger.error(`Suspicious zip entry prevented: ${file.path}`);
        throw new AppError(
          `Zip entry attempts directory traversal: ${file.path}`,
          400,
          'SECURITY_VIOLATION',
        );
      }

      if (file.type === 'Directory') {
        await fsp.mkdir(destinationPath, { recursive: true });
      } else {
        const parentDir = path.dirname(destinationPath);
        await fsp.mkdir(parentDir, { recursive: true });

        await new Promise<void>((resolve, reject) => {
          file
            .stream()
            .pipe(fs.createWriteStream(destinationPath))
            .on('finish', () => resolve())
            .on('error', (err) => reject(err));
        });
      }
    }

    logger.info(`Successfully extracted zip archive to ${targetDir}`);
  }

  /**
   * Deletes a temporary uploaded file.
   */
  static async removeUploadedFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fsp.unlink(filePath);
        logger.debug(`Removed temporary upload: ${filePath}`);
      }
    } catch (err) {
      logger.warn(`Failed to remove file ${filePath}:`, err);
    }
  }
}
