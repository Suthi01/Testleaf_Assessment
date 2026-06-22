import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Simple request ID generator
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Basic middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  (req as any).requestId = generateRequestId();
  res.setHeader('X-Request-ID', (req as any).requestId);
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check API
app.get('/health', (req, res) => {
  const llmConfig = {
    provider: process.env.LLM_PROVIDER || 'groq',
    model: process.env.LLM_MODEL || 'llama-3.3-70b',
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

// File Upload Endpoint (Phase 3) - Lazy load modules
app.post('/search/upload', async (req, res) => {
  try {
    const { upload: uploadMiddleware, deleteUploadedFile: deleteFile } = await import('./upload.js');
    const uploadHandler = uploadMiddleware.single('file');
    
    uploadHandler(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message || 'Upload failed'
        });
      }

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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Document Query Endpoint (Phase 7) - Lazy load modules
app.post('/search/document', async (req, res) => {
  const startTime = performance.now();
  
  try {
    const { upload: uploadMiddleware, deleteUploadedFile } = await import('./upload.js');
    const { loadDocument, validateDocument } = await import('./loaders.js');
    const { getModel } = await import('./model.js');
    const { createQAChain } = await import('./chain.js');
    const { validateDocumentQuery, validateUploadedFile } = await import('./validation.js');

    const uploadHandler = uploadMiddleware.single('file');

    uploadHandler(req, res, async (err: any) => {
      try {
        if (err) {
          return res.status(400).json({
            success: false,
            error: err.message || 'Upload failed'
          });
        }

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
            model: process.env.LLM_MODEL || 'llama-3.3-70b',
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
            model: process.env.LLM_MODEL || 'llama-3.3-70b',
            provider: process.env.LLM_PROVIDER || 'groq',
            processingTime: `${processingTime}s`,
            promptType: promptType || 'default',
            documentLength: documentContent.length,
            questionLength: question.length
          }
        });

      } catch (error: any) {
        if (req.file) {
          const { deleteUploadedFile } = await import('./upload.js');
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

  } catch (error: any) {
    console.error('Document endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error'
    });
  }
});

// Error handling middleware (Phase 8: Production Ready)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = (req as any).requestId || 'unknown';
  const statusCode = err.status || err.statusCode || 500;

  console.error(`[${statusCode}] ${req.method} ${req.path} - ${err.message}`);

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║         Q&A BOT - ALL 8 PHASES COMPLETE! ✓                ║
╠═══════════════════════════════════════════════════════════╣
║  ✓ Phase 1: Project Setup & Foundation                    ║
║  ✓ Phase 2: UI Development & Validation                   ║
║  ✓ Phase 3: File Upload System (Multer)                   ║
║  ✓ Phase 4: Document Parsing (PDF/DOCX/CSV/TXT)          ║
║  ✓ Phase 5: LLM Integration (Groq Ready)                  ║
║  ✓ Phase 6: LangChain QA Chain                            ║
║  ✓ Phase 7: End-to-End API Integration                    ║
║  ✓ Phase 8: Production Readiness (Logging/Security)       ║
╠═══════════════════════════════════════════════════════════╣
║  🌐 Frontend: http://localhost:${PORT}                        ║
║  🏥 Health: http://localhost:${PORT}/health                 ║
║  📝 Setup: GROQ_API_KEY configured in .env                ║
║  📚 Docs: See README.md for full documentation            ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
