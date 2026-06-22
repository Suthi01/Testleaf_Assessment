import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { upload, deleteUploadedFile } from './upload.js';
import { getModelInfo, getModel } from './model.js';
import { loadDocument, validateDocument } from './loaders.js';
import { createQAChain } from './chain.js';
import { validateDocumentQuery, validateUploadedFile } from './validation.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));

// Health Check API
app.get('/health', (req, res) => {
  const llmConfig = {
    provider: process.env.LLM_PROVIDER || 'groq',
    model: process.env.LLM_MODEL || 'mixtral-8x7b',
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1024')
  };

  const hasGroqKey = !!process.env.GROQ_API_KEY;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    llm: {
      configured: hasGroqKey,
      provider: llmConfig.provider,
      model: llmConfig.model,
      temperature: llmConfig.temperature,
      maxTokens: llmConfig.maxTokens,
      warning: !hasGroqKey ? 'GROQ_API_KEY not set. LLM features will not work.' : null
    }
  });
});

// Home API
app.get('/', (req, res) => {
  res.json({
    message: 'Q&A Bot - Document Question Answering System',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      upload: 'POST /search/upload',
      document: 'POST /search/document'
    }
  });
});

// File Upload Endpoint (Phase 3)
app.post('/search/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file provided'
    });
  }

  res.json({
    success: true,
    message: 'File uploaded successfully',
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path,
      uploadedAt: new Date().toISOString()
    }
  });
});

// Document Query Endpoint (Phase 7 - Full Integration)
app.post('/search/document', upload.single('file'), async (req, res) => {
  const startTime = performance.now();
  
  try {
    // Validate file
    const fileValidation = validateUploadedFile(req.file);
    if (!fileValidation.valid) {
      if (req.file) deleteUploadedFile(req.file.path);
      return res.status(400).json({
        success: false,
        error: fileValidation.error
      });
    }

    // Validate request body
    const bodyValidation = validateDocumentQuery(req.body);
    if (!bodyValidation.valid) {
      deleteUploadedFile(req.file!.path);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: bodyValidation.errors
      });
    }

    const { question, promptType } = bodyValidation.data;
    const filePath = req.file!.path;

    // Validate document file
    const docValidation = validateDocument(filePath);
    if (!docValidation.valid) {
      deleteUploadedFile(filePath);
      return res.status(400).json({
        success: false,
        error: docValidation.error
      });
    }

    // Load document content
    let documentContent: string;
    try {
      documentContent = await loadDocument(filePath);
    } catch (error: any) {
      deleteUploadedFile(filePath);
      return res.status(400).json({
        success: false,
        error: `Failed to parse document: ${error.message}`
      });
    }

    // Initialize LLM and QA chain
    let qaChain;
    try {
      const llmConfig = {
        provider: (process.env.LLM_PROVIDER || 'groq') as 'groq' | 'openai' | 'anthropic',
        model: process.env.LLM_MODEL || 'mixtral-8x7b',
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1024')
      };

      const model = getModel(llmConfig);
      qaChain = createQAChain(model);
    } catch (error: any) {
      deleteUploadedFile(filePath);
      return res.status(503).json({
        success: false,
        error: `LLM initialization failed: ${error.message}`
      });
    }

    // Get answer from QA chain
    let answer: string;
    try {
      answer = await qaChain.invoke(
        documentContent,
        question,
        (promptType || 'default') as any
      );
    } catch (error: any) {
      deleteUploadedFile(filePath);
      return res.status(500).json({
        success: false,
        error: `Failed to generate answer: ${error.message}`
      });
    }

    const endTime = performance.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(3);

    // Clean up uploaded file
    deleteUploadedFile(filePath);

    // Return successful response
    res.json({
      success: true,
      answer,
      metadata: {
        model: process.env.LLM_MODEL || 'mixtral-8x7b',
        provider: process.env.LLM_PROVIDER || 'groq',
        processingTime: `${processingTime}s`,
        promptType: promptType || 'default',
        documentLength: documentContent.length,
        questionLength: question.length
      }
    });

  } catch (error: any) {
    if (req.file) {
      deleteUploadedFile(req.file.path);
    }
    console.error('Endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Multer errors
  if (err.code === 'LIMIT_PART_COUNT') {
    return res.status(400).json({
      success: false,
      error: 'Too many parts'
    });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large. Maximum size: 10MB'
    });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      error: 'Too many files'
    });
  }
  if (err.code === 'LIMIT_FIELD_KEY') {
    return res.status(400).json({
      success: false,
      error: 'Field name too long'
    });
  }
  if (err.code === 'LIMIT_FIELD_VALUE') {
    return res.status(400).json({
      success: false,
      error: 'Field value too long'
    });
  }
  if (err.code === 'LIMIT_FIELD_COUNT') {
    return res.status(400).json({
      success: false,
      error: 'Too many fields'
    });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file uploaded'
    });
  }

  // Multer file validation errors
  if (err.message && err.message.includes('Invalid file')) {
    return res.status(415).json({
      success: false,
      error: err.message
    });
  }

  // Generic errors
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
});
