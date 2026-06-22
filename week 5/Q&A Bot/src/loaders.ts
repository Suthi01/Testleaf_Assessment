import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import mammoth from 'mammoth';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { PDFParse } from 'pdf-parse';

/**
 * File type detection by magic bytes
 */
function detectFileType(buffer: Buffer): string {
  // PDF: %PDF
  if (buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'pdf';
  }
  
  // DOCX: PK (ZIP format)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return 'docx';
  }
  
  // CSV/TXT: Plain text (often starts with letters or quotes)
  if (buffer[0] < 128 && (buffer[0] > 31 || buffer[0] === 9 || buffer[0] === 10)) {
    return 'text';
  }
  
  return 'unknown';
}

/**
 * Document Loader Interface
 * All loaders must implement this interface
 */
export interface DocumentLoader {
  load(filePath: string): Promise<string>;
}

/**
 * PDF Loader
 * Extracts text from PDF files with enhanced error handling
 */
export class PDFLoader implements DocumentLoader {
  async load(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      
      // Validate PDF header first
      const header = dataBuffer.toString('ascii', 0, 4);
      if (header !== '%PDF') {
        // Read what we got instead
        const actualHeader = dataBuffer.slice(0, 20).toString('utf8', 0, 20).replace(/\0/g, '?');
        throw new Error(
          `Invalid PDF header. Expected "%PDF" but got "${actualHeader}". ` +
          `File may be corrupted or not a valid PDF.`
        );
      }
      
      // Initialize PDFParse with the PDF data
      const pdfParser = new PDFParse({ 
        data: dataBuffer,
        verbosity: -1  // Suppress verbose logging
      });
      
      try {
        // Try to extract text
        let textResult;
        try {
          textResult = await pdfParser.getText();
        } catch (textError: any) {
          // If getText fails, try getInfo as fallback
          console.warn('getText failed, trying alternative extraction method');
          const infoResult = await pdfParser.getInfo();
          textResult = { text: `PDF has ${infoResult.total} pages` };
        }
        
        let text = textResult?.text || '';
        
        // If no text extracted, provide helpful guidance
        if (!text || !text.trim()) {
          // Try to get page count info
          try {
            const infoResult = await pdfParser.getInfo();
            throw new Error(
              `No extractable text found. This PDF may be scanned/image-based (${infoResult.total} pages). ` +
              `Try using OCR tools or convert the PDF to ensure it contains selectable text.`
            );
          } catch (infoErr: any) {
            throw new Error('PDF appears to be empty or contains only images. Please try a PDF with text content.');
          }
        }
        
        // Clean up extracted text
        text = text
          .replace(/\0/g, '')  // Remove null characters
          .replace(/\f/g, '\n')  // Replace form feeds with newlines
          .replace(/\r\n/g, '\n')  // Normalize line endings
          .trim();
        
        return text;
      } finally {
        // Clean up resources
        try {
          await pdfParser.destroy();
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      
      // Provide helpful error messages
      if (errorMsg.includes('Invalid PDF') || errorMsg.includes('header')) {
        throw new Error(`PDF parsing failed: ${errorMsg}`);
      } else if (errorMsg.includes('password')) {
        throw new Error(`PDF parsing failed: This PDF is password-protected. Please remove the password protection first.`);
      } else if (errorMsg.includes('scanned') || errorMsg.includes('image')) {
        throw new Error(`PDF parsing failed: This appears to be a scanned/image-based PDF. Please ensure the PDF contains selectable text or use OCR.`);
      } else {
        throw new Error(`PDF parsing failed: ${errorMsg}`);
      }
    }
  }
}

/**
 * DOCX Loader
 * Extracts text from DOCX (Word) files
 */
export class DocxLoader implements DocumentLoader {
  async load(filePath: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      
      if (!result.value.trim()) {
        throw new Error('No text content found in DOCX');
      }
      
      return result.value;
    } catch (error: any) {
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }
}

/**
 * CSV Loader
 * Extracts and formats text from CSV files
 */
export class CSVLoader implements DocumentLoader {
  async load(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const rows: any[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rows.push(row);
        })
        .on('end', () => {
          if (rows.length === 0) {
            return reject(new Error('CSV file is empty'));
          }
          
          // Format CSV data as readable text
          const headers = Object.keys(rows[0]);
          let text = `CSV Data with columns: ${headers.join(', ')}\n\n`;
          
          rows.forEach((row, index) => {
            text += `Row ${index + 1}:\n`;
            headers.forEach(header => {
              text += `  ${header}: ${row[header]}\n`;
            });
            text += '\n';
          });
          
          resolve(text);
        })
        .on('error', (error: any) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        });
    });
  }
}

/**
 * Text File Loader
 * Loads plain text files
 */
export class TextLoader implements DocumentLoader {
  async load(filePath: string): Promise<string> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (!content.trim()) {
        throw new Error('Text file is empty');
      }
      
      return content;
    } catch (error: any) {
      throw new Error(`Text file loading failed: ${error.message}`);
    }
  }
}

/**
 * Document Loader Factory
 * Creates appropriate loader based on file type
 */
export class DocumentLoaderFactory {
  static getLoader(filePath: string): DocumentLoader {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.pdf':
        return new PDFLoader();
      case '.docx':
        return new DocxLoader();
      case '.csv':
        return new CSVLoader();
      case '.txt':
        return new TextLoader();
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }
}

/**
 * Load and parse a document
 * @param filePath Path to the document file
 * @returns Extracted text content
 */
export async function loadDocument(filePath: string): Promise<string> {
  const loader = DocumentLoaderFactory.getLoader(filePath);
  return await loader.load(filePath);
}

/**
 * Validate document file
 * @param filePath Path to the document file
 * @returns Validation result
 */
export function validateDocument(filePath: string): { valid: boolean; error?: string } {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'File does not exist' };
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const validExtensions = ['.pdf', '.docx', '.csv', '.txt'];
  
  if (!validExtensions.includes(ext)) {
    return { valid: false, error: `Unsupported file type: ${ext}` };
  }
  
  const stats = fs.statSync(filePath);
  const maxSize = 10 * 1024 * 1024; // 10 MB
  
  if (stats.size > maxSize) {
    return { valid: false, error: `File exceeds maximum size of 10MB` };
  }
  
  if (stats.size === 0) {
    return { valid: false, error: `File is empty` };
  }
  
  // Check file content by reading first few bytes
  try {
    const buffer = Buffer.alloc(512);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 512, null);
    fs.closeSync(fd);
    
    const detectedType = detectFileType(buffer);
    
    // For PDFs, verify PDF header
    if (ext === '.pdf') {
      if (detectedType !== 'pdf') {
        return { 
          valid: false, 
          error: `File appears to be corrupted or not a valid PDF. Detected type: ${detectedType}` 
        };
      }
    }
    
    // For DOCX, verify ZIP format
    if (ext === '.docx') {
      if (detectedType !== 'docx') {
        return { 
          valid: false, 
          error: `File appears to be corrupted or not a valid DOCX. Detected type: ${detectedType}` 
        };
      }
    }
  } catch (error: any) {
    return { valid: false, error: `Error reading file: ${error.message}` };
  }
  
  return { valid: true };
}
