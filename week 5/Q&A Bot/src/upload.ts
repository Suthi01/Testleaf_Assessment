import multer, { StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Upload directory
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed file types
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/plain'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.csv', '.txt'];

// File size limit (10 MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Configure storage
const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file extension: ${ext}`));
  }

  cb(null, true);
};

// Create upload middleware
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// Utility functions
export function getUploadDir(): string {
  return uploadDir;
}

export function deleteUploadedFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFileSize(fileSize: number): FileValidationResult {
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds limit. Max: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }
  return { valid: true };
}
