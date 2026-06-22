import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { HumanMessage } from '@langchain/core/messages';

/**
 * Prompt Types for different response styles
 */
export type PromptType = 'default' | 'detailed' | 'concise' | 'technical';

/**
 * Prompt Templates for different response styles
 */
const PROMPT_TEMPLATES: Record<PromptType, string> = {
  default: `Based on the following document content, answer the user's question clearly and concisely.

Document Content:
{document}

Question: {question}

Answer:`,

  detailed: `Based on the following document content, provide a detailed and comprehensive answer to the user's question. Include relevant examples and context from the document.

Document Content:
{document}

Question: {question}

Detailed Answer:`,

  concise: `Based on the following document content, answer the user's question in a brief and concise manner. Keep your response to 2-3 sentences maximum.

Document Content:
{document}

Question: {question}

Brief Answer:`,

  technical: `Based on the following document content, provide a technical answer to the user's question. Use technical terminology and be precise.

Document Content:
{document}

Question: {question}

Technical Answer:`
};

/**
 * Simple text chunking utility
 * Splits text into chunks with optional overlap
 */
export function chunkText(
  text: string,
  chunkSize: number = 2000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}

/**
 * QA Chain for document question answering
 */
export class DocumentQAChain {
  private model: BaseLanguageModel;
  private promptType: PromptType = 'default';
  private maxDocumentLength: number = 4000; // Max chars to include in prompt

  constructor(model: BaseLanguageModel) {
    this.model = model;
  }

  /**
   * Set the prompt type
   */
  setPromptType(promptType: PromptType): void {
    if (!PROMPT_TEMPLATES[promptType]) {
      throw new Error(`Unknown prompt type: ${promptType}`);
    }
    this.promptType = promptType;
  }

  /**
   * Prepare document content for the LLM
   * Truncate if necessary to fit within token limits
   */
  private prepareDocument(document: string): string {
    if (document.length > this.maxDocumentLength) {
      return document.substring(0, this.maxDocumentLength) + '\n... [content truncated]';
    }
    return document;
  }

  /**
   * Invoke the QA chain
   */
  async invoke(
    document: string,
    question: string,
    promptType?: PromptType
  ): Promise<string> {
    if (promptType) {
      this.setPromptType(promptType);
    }

    const templateString = PROMPT_TEMPLATES[this.promptType];
    const documentContent = this.prepareDocument(document);

    try {
      // Format the template string with document and question
      const prompt = templateString
        .replace('{document}', documentContent)
        .replace('{question}', question);

      // Create a HumanMessage and invoke the model
      const message = new HumanMessage(prompt);
      const response = await this.model.invoke([message]);

      // Extract text from response
      if (typeof response === 'string') {
        return response;
      } else if (response && typeof response === 'object') {
        if ('content' in response) {
          return (response as any).content;
        } else if ('text' in response) {
          return (response as any).text;
        }
      }

      return String(response);
    } catch (error: any) {
      throw new Error(`QA Chain failed: ${error.message}`);
    }
  }

  /**
   * Get available prompt types
   */
  static getAvailablePromptTypes(): PromptType[] {
    return Object.keys(PROMPT_TEMPLATES) as PromptType[];
  }

  /**
   * Get prompt template for a given type
   */
  static getPromptTemplate(promptType: PromptType): string {
    return PROMPT_TEMPLATES[promptType] || PROMPT_TEMPLATES.default;
  }
}

/**
 * Create a QA chain
 */
export function createQAChain(model: BaseLanguageModel): DocumentQAChain {
  return new DocumentQAChain(model);
}
