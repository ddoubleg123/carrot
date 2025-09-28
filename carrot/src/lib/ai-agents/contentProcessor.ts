import { RetrievedContent } from './contentRetriever';

export interface ProcessedContent {
  id: string;
  title: string;
  url: string;
  content: string;
  chunks: ContentChunk[];
  metadata: ContentMetadata;
  embedding?: number[];
  sourceType: string;
  sourceTitle: string;
  sourceAuthor?: string;
  relevanceScore: number;
}

export interface ContentChunk {
  id: string;
  content: string;
  chunkIndex: number;
  embedding?: number[];
  metadata: {
    startChar: number;
    endChar: number;
    tokenCount: number;
  };
}

export interface ContentMetadata {
  wordCount: number;
  tokenCount: number;
  language: string;
  topics: string[];
  entities: string[];
  summary: string;
  processedAt: Date;
}

export class ContentProcessor {
  private static readonly MAX_CHUNK_SIZE = 1000; // tokens
  private static readonly CHUNK_OVERLAP = 100; // tokens
  private static readonly MIN_CHUNK_SIZE = 200; // tokens

  /**
   * Process raw content into structured format
   */
  static async processContent(content: RetrievedContent): Promise<ProcessedContent> {
    try {
      // Clean and normalize content
      const cleanedContent = this.cleanContent(content.content);
      
      // Extract metadata
      const metadata = await this.extractMetadata(cleanedContent, content);
      
      // Chunk content
      const chunks = this.chunkContent(cleanedContent);
      
      // Generate summary
      const summary = await this.generateSummary(cleanedContent);
      
      // Update metadata with summary
      metadata.summary = summary;
      
      return {
        id: this.generateId(content),
        title: content.title,
        url: content.url,
        content: cleanedContent,
        chunks,
        metadata,
        sourceType: content.sourceType,
        sourceTitle: content.sourceTitle,
        sourceAuthor: content.sourceAuthor,
        relevanceScore: content.relevanceScore
      };
    } catch (error) {
      console.error('Error processing content:', error);
      throw error;
    }
  }

  /**
   * Clean and normalize content
   */
  private static cleanContent(content: string): string {
    return content
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters but keep punctuation
      .replace(/[^\w\s.,!?;:()\-'"]/g, '')
      // Remove multiple newlines
      .replace(/\n\s*\n/g, '\n')
      // Trim
      .trim();
  }

  /**
   * Extract metadata from content
   */
  private static async extractMetadata(content: string, original: RetrievedContent): Promise<ContentMetadata> {
    const wordCount = content.split(/\s+/).length;
    const tokenCount = Math.ceil(wordCount * 1.3); // Rough estimate
    const language = this.detectLanguage(content);
    const topics = this.extractTopics(content);
    const entities = this.extractEntities(content);

    return {
      wordCount,
      tokenCount,
      language,
      topics,
      entities,
      summary: '', // Will be set later
      processedAt: new Date()
    };
  }

  /**
   * Chunk content into digestible pieces
   */
  private static chunkContent(content: string): ContentChunk[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: ContentChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;
    let startChar = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + sentence;
      
      // Estimate token count (rough approximation)
      const tokenCount = Math.ceil(potentialChunk.split(/\s+/).length * 1.3);
      
      if (tokenCount > this.MAX_CHUNK_SIZE && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          id: `${chunkIndex}`,
          content: currentChunk,
          chunkIndex,
          metadata: {
            startChar,
            endChar: startChar + currentChunk.length,
            tokenCount: Math.ceil(currentChunk.split(/\s+/).length * 1.3)
          }
        });
        
        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + (overlapText ? '. ' : '') + sentence;
        startChar += currentChunk.length - overlapText.length;
        chunkIndex++;
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${chunkIndex}`,
        content: currentChunk.trim(),
        chunkIndex,
        metadata: {
          startChar,
          endChar: startChar + currentChunk.length,
          tokenCount: Math.ceil(currentChunk.split(/\s+/).length * 1.3)
        }
      });
    }

    return chunks;
  }

  /**
   * Get overlap text for chunking
   */
  private static getOverlapText(text: string): string {
    const words = text.split(/\s+/);
    const overlapWords = Math.min(this.CHUNK_OVERLAP, words.length);
    return words.slice(-overlapWords).join(' ');
  }

  /**
   * Detect language of content
   */
  private static detectLanguage(content: string): string {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = content.toLowerCase().split(/\s+/);
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    
    return englishCount > words.length * 0.1 ? 'en' : 'unknown';
  }

  /**
   * Extract topics from content
   */
  private static extractTopics(content: string): string[] {
    // Simple topic extraction based on capitalized words and common patterns
    const words = content.split(/\s+/);
    const topics: string[] = [];
    
    // Look for capitalized words (potential proper nouns)
    const capitalizedWords = words.filter(word => 
      word.length > 3 && 
      /^[A-Z]/.test(word) && 
      !/^[A-Z]+$/.test(word) // Not all caps
    );
    
    // Look for common topic patterns
    const topicPatterns = [
      /(\w+)\s+(theory|method|approach|model|framework)/gi,
      /(quantum|relativity|evolution|democracy|economics|physics|biology)/gi,
      /(artificial intelligence|machine learning|deep learning|neural network)/gi
    ];
    
    topicPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        topics.push(...matches.map(m => m.toLowerCase()));
      }
    });
    
    // Add some capitalized words as topics
    topics.push(...capitalizedWords.slice(0, 5).map(w => w.toLowerCase()));
    
    return [...new Set(topics)].slice(0, 10);
  }

  /**
   * Extract entities from content
   */
  private static extractEntities(content: string): string[] {
    // Simple entity extraction
    const entities: string[] = [];
    
    // Look for quoted text
    const quoted = content.match(/"([^"]+)"/g);
    if (quoted) {
      entities.push(...quoted.map(q => q.replace(/"/g, '')));
    }
    
    // Look for capitalized phrases
    const capitalizedPhrases = content.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
    if (capitalizedPhrases) {
      entities.push(...capitalizedPhrases.slice(0, 10));
    }
    
    return [...new Set(entities)].slice(0, 15);
  }

  /**
   * Generate summary of content
   */
  private static async generateSummary(content: string): Promise<string> {
    // Simple extractive summarization
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 3) {
      return content;
    }
    
    // Take first few sentences as summary
    const summarySentences = sentences.slice(0, Math.min(3, sentences.length));
    return summarySentences.join('. ') + '.';
  }

  /**
   * Generate unique ID for content
   */
  private static generateId(content: RetrievedContent): string {
    const urlHash = this.simpleHash(content.url);
    const titleHash = this.simpleHash(content.title);
    return `${urlHash}-${titleHash}`;
  }

  /**
   * Simple hash function
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Process multiple contents in batch
   */
  static async processBatch(contents: RetrievedContent[]): Promise<ProcessedContent[]> {
    const results: ProcessedContent[] = [];
    
    for (const content of contents) {
      try {
        const processed = await this.processContent(content);
        results.push(processed);
      } catch (error) {
        console.error('Error processing content in batch:', error);
        continue;
      }
    }
    
    return results;
  }
}
