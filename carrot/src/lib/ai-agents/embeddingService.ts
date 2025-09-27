import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EmbeddingResult {
  embedding: number[];
  content: string;
  metadata?: any;
}

export interface MemoryData {
  agentId: string;
  content: string;
  sourceType: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceAuthor?: string;
  tags?: string[];
  confidence?: number;
  threadId?: string;
  topicId?: string;
  fedBy?: string;
}

export class EmbeddingService {
  /**
   * Generate embedding for text content
   * For now, using a sophisticated mock embedding - can be replaced with OpenAI, DeepSeek, or local model
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    // Simplified mock embedding to avoid memory issues on Render
    const textHash = this.simpleHash(text);
    const embedding = new Array(128).fill(0); // Smaller embedding size
    
    // Create a simple deterministic embedding
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = Math.sin(textHash + i) * 0.1;
    }
    
    return embedding;
  }

  /**
   * Simple hash function for mock embeddings
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Store memory with embedding
   */
  static async storeMemory(data: MemoryData) {
    const embedding = await this.generateEmbedding(data.content);
    
    return await prisma.agentMemory.create({
      data: {
        agentId: data.agentId,
        content: data.content,
        embedding: embedding,
        sourceType: data.sourceType,
        sourceUrl: data.sourceUrl,
        sourceTitle: data.sourceTitle,
        sourceAuthor: data.sourceAuthor,
        tags: data.tags || [],
        confidence: data.confidence || 1.0,
        threadId: data.threadId,
        topicId: data.topicId,
        fedBy: data.fedBy,
      },
    });
  }

  /**
   * Find similar memories using cosine similarity
   */
  static async findSimilarMemories(
    agentId: string,
    query: string,
    limit: number = 10
  ) {
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Get all memories for the agent
    const memories = await prisma.agentMemory.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate cosine similarity
    const similarities = memories.map(memory => ({
      ...memory,
      similarity: this.cosineSimilarity(queryEmbedding, memory.embedding),
    }));

    // Sort by similarity and return top results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Chunk text content for better embedding
   */
  static chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    // Simplified to avoid memory issues - just return single chunk
    return [text.substring(0, chunkSize)];
  }

  /**
   * Extract and clean content from various sources
   */
  static async extractContent(sourceType: string, source: any): Promise<string> {
    switch (sourceType) {
      case 'url':
        // TODO: Implement web scraping
        return source.content || source.text || '';
      
      case 'file':
        // TODO: Implement file parsing (PDF, DOC, etc.)
        return source.content || source.text || '';
      
      case 'post':
        return source.body || source.content || '';
      
      case 'manual':
        return source.content || source.text || '';
      
      default:
        return source.content || source.text || '';
    }
  }
}

export default EmbeddingService;
