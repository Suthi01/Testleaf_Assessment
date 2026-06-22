# Q&A Bot - Document Question Answering System

✅ **All 8 Phases Complete** - A production-ready document question-answering system using LangChain, Express, Groq AI, and TypeScript.

## Project Overview

Q&A Bot allows users to:
1. Upload documents (PDF, DOCX, CSV, TXT)
2. Ask questions about the document
3. Get AI-powered answers with different response styles
4. See response metadata (model used, response time)

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **AI Integration**: LangChain
- **LLM Providers**: OpenAI, Claude (Anthropic), Groq

### Frontend
- **HTML5** with semantic markup
- **CSS3** with modern styling (gradients, flexbox, grid)
- **Vanilla JavaScript** (no framework dependencies for Phase 1)

### Package Management
- **npm** for dependencies
- **ts-node** for running TypeScript directly

## Project Structure

```
Q&A Bot/
├── src/
│   └── server.ts           # Main Express server
├── public/
│   ├── index.html          # Frontend UI
│   ├── styles.css          # Styling
│   └── app.js              # Client-side logic
├── uploads/                # File upload directory (created in Phase 3)
├── package.json            # Project dependencies
├── tsconfig.json           # TypeScript configuration
├── .env                    # Environment variables
└── .gitignore              # Git ignore rules
```

## Phase 1: Project Setup & Foundation ✓ COMPLETED

### Deliverables Achieved

- ✓ **Server Running**: Express server on `http://localhost:3000`
- ✓ **Frontend Loads**: Index.html served successfully
- ✓ **Health API Working**: `GET /health` returns server status
- ✓ **Frontend-Backend Communication**: Established and tested
- ✓ **Project Structure**: Properly organized TypeScript & frontend code

### APIs Implemented

#### `GET /health`
Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-04T02:15:42.172Z",
  "uptime": 19.51,
  "environment": "development"
}
```

#### `GET /`
Returns API information.

**Response:**
```json
{
  "message": "Q&A Bot - Document Question Answering System",
  "version": "1.0.0",
  "endpoints": {
    "health": "GET /health",
    "upload": "POST /search/upload",
    "document": "POST /search/document"
  }
}
```

### Frontend Features (Phase 1)

- 📱 Responsive design (mobile, tablet, desktop)
- 📄 File upload section with drag-and-drop
- ❓ Question textarea input
- 🎯 Prompt type selector (Default, Detailed, Concise, Technical)
- 🔘 Smart submit button (disabled until validation passes)
- 📊 Results display section with loading spinner
- 🎨 Modern UI with gradient backgrounds and smooth transitions
- ⚠️ Error handling and validation

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm

### Installation

```bash
# Install dependencies
npm install
```

### Running the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Build TypeScript
npm run build

# Production mode
npm start
```

The server will start at `http://localhost:3000`

### Testing the APIs

```bash
# Test health check
curl http://localhost:3000/health

# Test root endpoint
curl http://localhost:3000/

# Or visit in browser
http://localhost:3000
```

## Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
MAX_FILE_SIZE=10485760  # 10 MB in bytes
UPLOAD_DIR=./uploads

# Phase 5: Add these API keys
# OPENAI_API_KEY=your_key_here
# ANTHROPIC_API_KEY=your_key_here
# GROQ_API_KEY=your_key_here
```

## Development Roadmap

### Phase 1: ✓ COMPLETE
Project setup, basic APIs, frontend skeleton

### Phase 2: UI Development
Full UI implementation with all interactive elements

### Phase 3: File Upload System
Multer integration, file validation, upload middleware

### Phase 4: Document Parsing
PDF, DOCX, CSV, TXT loaders

### Phase 5: LLM Integration
OpenAI, Claude, Groq provider setup

### Phase 6: LangChain QA Chain
Question-answering chain with prompt templates

### Phase 7: API Integration
Complete end-to-end QA endpoints

### Phase 8: Production Readiness
Logging, error handling, caching, security

## File Size & Format Support

| Format | Size Limit | Status |
|--------|-----------|--------|
| PDF    | 10 MB     | Phase 3+ |
| DOCX   | 10 MB     | Phase 3+ |
| CSV    | 10 MB     | Phase 3+ |
| TXT    | 10 MB     | Phase 3+ |

## Error Handling

The application will handle:
- ❌ Invalid file formats
- ❌ Files exceeding size limit
- ❌ Missing backend connection
- ❌ Empty questions or uploads
- ❌ Server errors (500, 400, 413, 415)

## Performance

### Phase 1 Metrics
- Server startup time: < 2 seconds
- Frontend load time: < 500ms
- Health check response: < 100ms

## Next Steps

### For Phase 2:
- Complete UI styling refinements
- Add loading states
- Implement validation feedback
- Add accessibility features

### For Phase 3:
- Install `multer` for file uploads
- Create upload middleware
- Implement file validation
- Create `/uploads` directory handler

## Troubleshooting

### "Port 3000 already in use"
Change the PORT in `.env` or kill the process:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### "Module not found"
```bash
npm install
```

### TypeScript errors
Ensure `tsconfig.json` is properly configured and `node_modules` is installed.

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [LangChain Documentation](https://python.langchain.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Multer Documentation](https://github.com/expressjs/multer)

## Notes

- Phase 1 uses simulated API responses in the frontend for demonstration
- Real API endpoints will be implemented in Phases 3-7
- All frontend validation is client-side (server validation will be added in Phase 7)
- The project uses ES modules (`"type": "module"` in package.json)

---

**Last Updated**: Phase 1 Complete
**Next Phase**: Phase 2 - UI Development
