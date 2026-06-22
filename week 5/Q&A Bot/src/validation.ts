/**
 * Validation schemas and utilities
 */

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate document query request
 */
export function validateDocumentQuery(data: any): { valid: boolean; data?: any; errors?: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid request body'] };
  }

  const { question, promptType } = data;

  // Validate question
  if (!question || typeof question !== 'string') {
    errors.push('Question is required and must be a string');
  } else if (question.trim().length < 3) {
    errors.push('Question must be at least 3 characters');
  } else if (question.trim().length > 500) {
    errors.push('Question must not exceed 500 characters');
  }

  // Validate promptType
  if (promptType) {
    const validTypes = ['default', 'detailed', 'concise', 'technical'];
    if (!validTypes.includes(promptType)) {
      errors.push(`Invalid prompt type. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      question: question.trim(),
      promptType: promptType || 'default'
    }
  };
}

/**
 * Validate file existence and format
 */
export function validateUploadedFile(file: any): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file uploaded' };
  }

  if (!file.path) {
    return { valid: false, error: 'File path not found' };
  }

  const validMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'text/plain'
  ];

  if (!validMimeTypes.includes(file.mimetype)) {
    return { valid: false, error: `Invalid file type: ${file.mimetype}` };
  }

  return { valid: true };
}

/**
 * Request/Response types
 */
export interface DocumentQARequest {
  file: Express.Multer.File;
  question: string;
  promptType?: 'default' | 'detailed' | 'concise' | 'technical';
}

export interface DocumentQAResponse {
  success: boolean;
  answer?: string;
  metadata?: {
    model: string;
    provider: string;
    processingTime: number;
    tokensUsed?: number;
  };
  error?: string;
}
