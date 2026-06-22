import { ChatGroq } from '@langchain/groq';
import { BaseLanguageModel } from '@langchain/core/language_models/base';

/**
 * LLM Provider Configuration
 */
interface LLMConfig {
  provider: 'groq' | 'openai' | 'anthropic';
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey?: string;
}

/**
 * Supported Models by Provider
 */
const MODELS = {
  groq: {
    'llama-3.3-70b': 'llama-3.3-70b-versatile',
    'llama3-70b': 'llama3-70b-8192',
    'gemma-7b': 'gemma-7b-it'
  },
  openai: {
    'gpt-4': 'gpt-4',
    'gpt-3.5-turbo': 'gpt-3.5-turbo'
  },
  anthropic: {
    'claude-3-sonnet': 'claude-3-sonnet-20240229',
    'claude-3-haiku': 'claude-3-haiku-20240307'
  }
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: LLMConfig = {
  provider: 'groq',
  model: 'llama-3.3-70b',
  temperature: 0.7,
  maxTokens: 1024
};

/**
 * Get LLM Model
 * @param config Configuration for the LLM
 * @returns Initialized language model
 */
export function getModel(config: Partial<LLMConfig> = {}): BaseLanguageModel {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  switch (finalConfig.provider) {
    case 'groq':
      return getGroqModel(finalConfig);
    case 'openai':
      throw new Error('OpenAI provider not yet configured. Use Groq for now.');
    case 'anthropic':
      throw new Error('Anthropic provider not yet configured. Use Groq for now.');
    default:
      throw new Error(`Unknown provider: ${finalConfig.provider}`);
  }
}

/**
 * Get Groq Model
 * @param config Configuration for Groq
 * @returns ChatGroq instance
 */
function getGroqModel(config: LLMConfig): ChatGroq {
  const apiKey = config.apiKey || process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY environment variable is not set. ' +
      'Please add your Groq API key to the .env file.'
    );
  }

  const modelName = MODELS.groq[config.model as keyof typeof MODELS.groq];
  
  if (!modelName) {
    throw new Error(
      `Unknown Groq model: ${config.model}. ` +
      `Available models: ${Object.keys(MODELS.groq).join(', ')}`
    );
  }

  return new ChatGroq({
    apiKey,
    model: modelName,
    temperature: config.temperature,
    maxTokens: config.maxTokens
  } as any);
}

/**
 * Get available models for a provider
 * @param provider Provider name
 * @returns List of available models
 */
export function getAvailableModels(provider: keyof typeof MODELS): string[] {
  return Object.keys(MODELS[provider]);
}

/**
 * Get model information
 * @param config LLM configuration
 * @returns Model information object
 */
export function getModelInfo(config: Partial<LLMConfig> = {}): {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
} {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  return {
    provider: finalConfig.provider,
    model: finalConfig.model,
    temperature: finalConfig.temperature,
    maxTokens: finalConfig.maxTokens
  };
}

/**
 * Verify LLM is working
 * @param config LLM configuration
 * @returns Test result
 */
export async function testLLM(config: Partial<LLMConfig> = {}): Promise<{
  success: boolean;
  message: string;
  model?: string;
  provider?: string;
}> {
  try {
    const model = getModel(config);
    
    // Try a simple invocation
    const result = await model.invoke('Say hello in one word');
    
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    return {
      success: true,
      message: 'LLM is working correctly',
      provider: finalConfig.provider,
      model: finalConfig.model
    };
  } catch (error: any) {
    return {
      success: false,
      message: `LLM test failed: ${error.message}`
    };
  }
}

export { ChatGroq };
