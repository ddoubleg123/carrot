export interface AgentConfig {
  // API Keys
  deepseekApiKey?: string;
  newsApiKey?: string;
  githubApiKey?: string;
  
  // Embedding Settings
  embeddingModel: string;
  embeddingDimensions: number;
  maxTokensPerChunk: number;
  
  // Content Processing
  maxContentLength: number;
  chunkOverlap: number;
  minChunkSize: number;
  
  // Rate Limiting
  requestsPerMinute: number;
  batchSize: number;
  
  // Caching
  enableCaching: boolean;
  cacheExpiryHours: number;
  
  // Quality Filters
  minRelevanceScore: number;
  maxDuplicateSimilarity: number;
  
  // Source Configuration
  enabledSources: string[];
  sourcePriorities: Record<string, number>;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  // API Keys (set via environment variables)
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  newsApiKey: process.env.NEWS_API_KEY,
  githubApiKey: process.env.GITHUB_API_KEY,
  
  // Embedding Settings
  embeddingModel: 'deepseek-embedding',
  embeddingDimensions: 1536,
  maxTokensPerChunk: 1000,
  
  // Content Processing
  maxContentLength: 50000,
  chunkOverlap: 100,
  minChunkSize: 200,
  
  // Rate Limiting
  requestsPerMinute: 60,
  batchSize: 10,
  
  // Caching
  enableCaching: true,
  cacheExpiryHours: 24,
  
  // Quality Filters
  minRelevanceScore: 0.3,
  maxDuplicateSimilarity: 0.85,
  
  // Source Configuration
  enabledSources: [
    'wikipedia',
    'arxiv',
    'pubmed',
    'stackoverflow',
    'github',
    'newsapi',
    'project gutenberg'
  ],
  sourcePriorities: {
    'wikipedia': 1.0,
    'arxiv': 0.9,
    'pubmed': 0.9,
    'stackoverflow': 0.8,
    'github': 0.7,
    'newsapi': 0.6,
    'project gutenberg': 0.8
  }
};

export class AgentConfigManager {
  private static config: AgentConfig = DEFAULT_AGENT_CONFIG;

  /**
   * Get current configuration
   */
  static getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  static updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get API key for service
   */
  static getApiKey(service: string): string | undefined {
    switch (service) {
      case 'deepseek':
        return this.config.deepseekApiKey;
      case 'news':
        return this.config.newsApiKey;
      case 'github':
        return this.config.githubApiKey;
      default:
        return undefined;
    }
  }

  /**
   * Check if source is enabled
   */
  static isSourceEnabled(sourceName: string): boolean {
    return this.config.enabledSources.includes(sourceName);
  }

  /**
   * Get source priority
   */
  static getSourcePriority(sourceName: string): number {
    return this.config.sourcePriorities[sourceName] || 0.5;
  }

  /**
   * Validate configuration
   */
  static validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.deepseekApiKey) {
      errors.push('DeepSeek API key is required for embedding generation');
    }

    if (this.config.maxTokensPerChunk < this.config.minChunkSize) {
      errors.push('maxTokensPerChunk must be greater than minChunkSize');
    }

    if (this.config.chunkOverlap >= this.config.maxTokensPerChunk) {
      errors.push('chunkOverlap must be less than maxTokensPerChunk');
    }

    if (this.config.minRelevanceScore < 0 || this.config.minRelevanceScore > 1) {
      errors.push('minRelevanceScore must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration summary
   */
  static getConfigSummary(): {
    totalSources: number;
    enabledSources: string[];
    hasApiKeys: Record<string, boolean>;
    embeddingModel: string;
    maxContentLength: number;
  } {
    return {
      totalSources: this.config.enabledSources.length,
      enabledSources: this.config.enabledSources,
      hasApiKeys: {
        deepseek: !!this.config.deepseekApiKey,
        news: !!this.config.newsApiKey,
        github: !!this.config.githubApiKey
      },
      embeddingModel: this.config.embeddingModel,
      maxContentLength: this.config.maxContentLength
    };
  }
}
