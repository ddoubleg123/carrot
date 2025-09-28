import { ProcessedContent, ContentChunk } from './contentProcessor';

export interface EmbeddingModel {
  name: string;
  dimensions: number;
  maxTokens: number;
  costPerToken: number;
  apiEndpoint?: string;
  apiKey?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount: number;
  cost: number;
  processingTime: number;
}

export class EnhancedEmbeddingService {
  // Available embedding models
  static readonly MODELS: Record<string, EmbeddingModel> = {
    'deepseek-embedding': {
      name: 'deepseek-embedding',
      dimensions: 1536,
      maxTokens: 8191,
      costPerToken: 0.0001 / 1000, // DeepSeek pricing
      apiEndpoint: 'https://api.deepseek.com/v1/embeddings'
    },
    'text-embedding-ada-002': {
      name: 'text-embedding-ada-002',
      dimensions: 1536,
      maxTokens: 8191,
      costPerToken: 0.0001 / 1000, // $0.0001 per 1K tokens
      apiEndpoint: 'https://api.openai.com/v1/embeddings'
    },
    'text-embedding-3-small': {
      name: 'text-embedding-3-small',
      dimensions: 1536,
      maxTokens: 8191,
      costPerToken: 0.00002 / 1000, // $0.00002 per 1K tokens
      apiEndpoint: 'https://api.openai.com/v1/embeddings'
    },
    'e5-base': {
      name: 'e5-base',
      dimensions: 768,
      maxTokens: 512,
      costPerToken: 0, // Free local model
    },
    'bge-small-en': {
      name: 'bge-small-en',
      dimensions: 384,
      maxTokens: 512,
      costPerToken: 0, // Free local model
    }
  };

  private static readonly DEFAULT_MODEL = 'deepseek-embedding';
  private static readonly CACHE = new Map<string, EmbeddingResult>();
  private static readonly BATCH_SIZE = 10;

  /**
   * Generate embedding for text using specified model
   */
  static async generateEmbedding(
    text: string, 
    modelName: string = this.DEFAULT_MODEL,
    apiKey?: string
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = `${modelName}:${this.simpleHash(text)}`;
    if (this.CACHE.has(cacheKey)) {
      return this.CACHE.get(cacheKey)!;
    }

    const model = this.MODELS[modelName];
    if (!model) {
      throw new Error(`Unknown embedding model: ${modelName}`);
    }

    // Truncate text if too long
    const truncatedText = this.truncateText(text, model.maxTokens);
    const tokenCount = this.estimateTokenCount(truncatedText);

    let embedding: number[];
    let cost = 0;

    try {
      if (model.apiEndpoint) {
        // Use API-based model
        embedding = await this.generateAPIMbedding(truncatedText, model, apiKey);
        cost = tokenCount * model.costPerToken;
      } else {
        // Use local model (placeholder - would integrate with local embedding service)
        embedding = await this.generateLocalEmbedding(truncatedText, model);
      }

      const result: EmbeddingResult = {
        embedding,
        model: modelName,
        tokenCount,
        cost,
        processingTime: Date.now() - startTime
      };

      // Cache result
      this.CACHE.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error(`Error generating embedding with ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  static async generateBatchEmbeddings(
    texts: string[],
    modelName: string = this.DEFAULT_MODEL,
    apiKey?: string
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    // Process in batches to avoid rate limits
    for (let i = 0; i < texts.length; i += this.BATCH_SIZE) {
      const batch = texts.slice(i, i + this.BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(text => this.generateEmbedding(text, modelName, apiKey))
      );
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + this.BATCH_SIZE < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Generate embedding for content chunks
   */
  static async generateChunkEmbeddings(
    chunks: ContentChunk[],
    modelName: string = this.DEFAULT_MODEL,
    apiKey?: string
  ): Promise<ContentChunk[]> {
    const texts = chunks.map(chunk => chunk.content);
    const embeddings = await this.generateBatchEmbeddings(texts, modelName, apiKey);
    
    return chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index].embedding
    }));
  }

  /**
   * Generate embedding for processed content
   */
  static async generateContentEmbedding(
    content: ProcessedContent,
    modelName: string = this.DEFAULT_MODEL,
    apiKey?: string
  ): Promise<ProcessedContent> {
    // Generate embedding for main content
    const contentEmbedding = await this.generateEmbedding(content.content, modelName, apiKey);
    
    // Generate embeddings for chunks
    const chunksWithEmbeddings = await this.generateChunkEmbeddings(content.chunks, modelName, apiKey);
    
    return {
      ...content,
      embedding: contentEmbedding.embedding,
      chunks: chunksWithEmbeddings
    };
  }

  /**
   * Calculate similarity between two embeddings
   */
  static calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    // Cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Find most similar content based on embedding
   */
  static findSimilarContent(
    queryEmbedding: number[],
    contentEmbeddings: Array<{ id: string; embedding: number[] }>,
    topK: number = 5
  ): Array<{ id: string; similarity: number }> {
    const similarities = contentEmbeddings.map(item => ({
      id: item.id,
      similarity: this.calculateSimilarity(queryEmbedding, item.embedding)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Generate API-based embedding
   */
  private static async generateAPIMbedding(
    text: string,
    model: EmbeddingModel,
    apiKey?: string
  ): Promise<number[]> {
    if (!apiKey) {
      throw new Error('API key required for API-based embedding models');
    }

    const response = await fetch(model.apiEndpoint!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: model.name
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API embedding failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Handle different response formats
    if (data.data && data.data[0] && data.data[0].embedding) {
      // OpenAI format
      return data.data[0].embedding;
    } else if (data.embedding) {
      // DeepSeek format
      return data.embedding;
    } else {
      throw new Error('Unexpected API response format');
    }
  }

  /**
   * Generate local embedding (placeholder)
   */
  private static async generateLocalEmbedding(
    text: string,
    model: EmbeddingModel
  ): Promise<number[]> {
    // Placeholder for local embedding generation
    // In production, this would integrate with a local embedding service
    // like sentence-transformers, Hugging Face, or Ollama
    
    // For now, return a random embedding of the correct dimensions
    const embedding = new Array(model.dimensions).fill(0).map(() => Math.random() - 0.5);
    
    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  /**
   * Truncate text to fit within token limit
   */
  private static truncateText(text: string, maxTokens: number): string {
    const words = text.split(/\s+/);
    const estimatedTokens = Math.ceil(words.length * 1.3);
    
    if (estimatedTokens <= maxTokens) {
      return text;
    }
    
    const maxWords = Math.floor(maxTokens / 1.3);
    return words.slice(0, maxWords).join(' ');
  }

  /**
   * Estimate token count for text
   */
  private static estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 0.75 words
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount * 1.3);
  }

  /**
   * Simple hash function for caching
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear embedding cache
   */
  static clearCache(): void {
    this.CACHE.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; models: string[] } {
    const models = new Set<string>();
    for (const key of this.CACHE.keys()) {
      const model = key.split(':')[0];
      models.add(model);
    }
    
    return {
      size: this.CACHE.size,
      models: Array.from(models)
    };
  }
}
