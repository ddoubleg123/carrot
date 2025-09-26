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
    // Enhanced mock embedding generation
    // This creates a more realistic embedding based on text characteristics
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0);
    
    // Create embeddings based on word frequency and position
    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // Generate embedding based on word characteristics
    Object.entries(wordFreq).forEach(([word, freq], index) => {
      const wordHash = this.simpleHash(word);
      const normalizedFreq = Math.log(freq + 1) / Math.log(words.length + 1);
      
      // Distribute word influence across multiple dimensions
      for (let i = 0; i < 10; i++) {
        const dim = (wordHash + i) % embedding.length;
        embedding[dim] += normalizedFreq * Math.sin(wordHash + i) * 0.1;
      }
    });
    
    // Add text length and structure features
    const textLength = text.length;
    const sentenceCount = text.split(/[.!?]+/).length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    
    // Add these features to specific dimensions
    embedding[0] = Math.tanh(textLength / 1000); // Normalize text length
    embedding[1] = Math.tanh(sentenceCount / 50); // Normalize sentence count
    embedding[2] = Math.tanh(avgWordLength / 10); // Normalize average word length
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = embedding[i] / magnitude;
      }
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
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      let chunk = text.slice(start, end);
      
      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastSentence = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastSentence, lastNewline);
        
        if (breakPoint > start + chunkSize * 0.5) {
          chunk = chunk.slice(0, breakPoint + 1);
        }
      }
      
      chunks.push(chunk.trim());
      start = start + chunk.length - overlap;
    }
    
    return chunks.filter(chunk => chunk.length > 0);
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
