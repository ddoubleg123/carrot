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
   * Simplified mock embedding to avoid memory issues on Render
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    // Simple mock embedding - just create a deterministic vector based on text hash
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
    return Math.abs(hash);
  }

  /**
   * Chunk text content for better embedding
   */
  static chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    // Simplified to avoid memory issues - just return single chunk
    return [text.substring(0, chunkSize)];
  }

  /**
   * Store memory with embedding
   */
  static async storeMemory(data: MemoryData) {
    // For now, return a mock memory to avoid Prisma build errors
    const mockId = `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[EmbeddingService] Mock memory stored: ${mockId}`);
    return { id: mockId };
  }

  /**
   * Find similar memories using cosine similarity
   * Simplified to avoid Prisma build errors
   */
  static async findSimilarMemories(
    agentId: string,
    query: string,
    limit: number = 10
  ) {
    console.log(`[EmbeddingService] Mock findSimilarMemories for agent ${agentId}`);
    return [];
  }
}