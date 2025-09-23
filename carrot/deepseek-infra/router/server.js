import express from 'express';
import fetch from 'node-fetch';
import { createClient } from 'redis';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Logger setup
const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'router.log' })
  ]
});

// Redis client
let redisClient;
try {
  redisClient = createClient({ url: REDIS_URL });
  redisClient.on('error', (err) => logger.error('Redis Client Error', err));
  redisClient.connect();
} catch (err) {
  logger.warn('Redis not available, using in-memory cache');
  redisClient = null;
}

// In-memory cache fallback
const memoryCache = new Map();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Express app
const app = express();
app.use(helmet());
app.use(cors());
app.use(limiter);
app.use(express.json({ limit: '2mb' }));

// Load prompt packs
const PROMPTS = {};
const loadPrompts = async () => {
  try {
    const promptsDir = path.join(__dirname, 'prompts');
    const files = await fs.readdir(promptsDir);
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const name = file.replace('.md', '');
        const content = await fs.readFile(path.join(promptsDir, file), 'utf8');
        PROMPTS[name] = content;
        logger.info(`Loaded prompt: ${name}`);
      }
    }
  } catch (err) {
    logger.warn('Could not load prompts, using defaults');
  }
};

// Default system prompts
const DEFAULT_PROMPTS = {
  'editor@v1': 'Role: crisp copy editor. Tighten grammar/spelling without changing meaning. Output only edited text.',
  'refactor_hook@v1': 'Role: senior React+TS engineer. Extract state into reusable hook. Keep types; no behavior change; add minimal JSDoc.',
  'explain_tests@v1': 'Role: staff engineer. 1) Explain function & edge cases. 2) Produce Jest tests (happy path + 3 edges).',
  'chat': 'You are a helpful coding assistant.',
  'rag-code': 'Use ONLY provided code context. If missing, say so.',
  'rag-doc': 'Use ONLY provided document context with citations. If missing, say so.'
};

// Model routing logic
const chooseModel = (task, riskLevel = 'low') => {
  const taskLower = task.toLowerCase();
  
  // High risk tasks use 16B model
  if (riskLevel === 'high' || taskLower.includes('refactor') || taskLower.includes('tests') || taskLower.startsWith('rag')) {
    return { 
      base: 'deepseek-coder-v2:16b', 
      url: OLLAMA_URL,
      maxTokens: 2000
    };
  }
  
  // Low risk tasks use 6.7B model
  if (taskLower === 'editor' || taskLower === 'ci') {
    return { 
      base: 'deepseek-coder:6.7b', 
      url: OLLAMA_URL,
      maxTokens: 700
    };
  }
  
  // Default to 16B for unknown tasks
  return { 
    base: 'deepseek-coder-v2:16b', 
    url: OLLAMA_URL,
    maxTokens: 1000
  };
};

// Safety filters
const preFilters = {
  moderation: (text) => {
    const sensitivePatterns = [
      /political/i, /election/i, /government/i, /policy/i,
      /hate/i, /discrimination/i, /violence/i
    ];
    return sensitivePatterns.some(pattern => pattern.test(text));
  },
  
  pii: (text) => {
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}-\d{3}-\d{4}\b/ // Phone
    ];
    return piiPatterns.some(pattern => pattern.test(text));
  }
};

const postFilters = {
  secrets: (text) => {
    const secretPatterns = [
      /password\s*[:=]\s*\S+/i,
      /api[_-]?key\s*[:=]\s*\S+/i,
      /secret\s*[:=]\s*\S+/i,
      /token\s*[:=]\s*\S+/i
    ];
    return secretPatterns.some(pattern => pattern.test(text));
  },
  
  commands: (text) => {
    const dangerousCommands = [
      /rm\s+-rf/i, /del\s+\/s/i, /format\s+c:/i,
      /shutdown/i, /reboot/i, /init\s+0/i
    ];
    return dangerousCommands.some(pattern => pattern.test(text));
  }
};

// Cache functions
const getCache = async (key) => {
  if (redisClient) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      logger.error('Redis get error:', err);
    }
  }
  return memoryCache.get(key) || null;
};

const setCache = async (key, value, ttl = 3600) => {
  if (redisClient) {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (err) {
      logger.error('Redis set error:', err);
    }
  }
  memoryCache.set(key, value);
};

// RAG retrieval (placeholder for Phase 1)
const getRAGContext = async (taskType, contextRefs) => {
  // TODO: Implement actual RAG retrieval in Phase 1
  if (taskType.startsWith('rag-') && contextRefs) {
    return `\n\n--- CODE CONTEXT ---\n[Retrieved from: ${contextRefs}]\n--- END CONTEXT ---\n`;
  }
  return '';
};

// Main chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    const { messages, stream = false, max_tokens, temperature = 0.2 } = req.body;
    const taskType = (req.header('X-Task-Type') || 'chat').toLowerCase();
    const riskLevel = (req.header('X-Risk-Level') || 'low').toLowerCase();
    const contextRefs = req.header('X-Context-Refs');
    const modelAlias = req.header('X-Model-Alias');
    
    // Log request
    logger.info('Request received', {
      requestId,
      taskType,
      riskLevel,
      modelAlias,
      messageCount: messages?.length || 0
    });
    
    // Pre-filters
    const allText = messages?.map(m => m.content).join(' ') || '';
    if (preFilters.moderation(allText)) {
      logger.warn('Moderation filter triggered', { requestId, taskType });
      return res.status(400).json({
        error: 'Content flagged by moderation filters. Please review and try again.'
      });
    }
    
    if (preFilters.pii(allText)) {
      logger.warn('PII detected', { requestId, taskType });
      return res.status(400).json({
        error: 'PII detected. Please remove personal information and try again.'
      });
    }
    
    // Get system prompt
    const systemPrompt = PROMPTS[taskType] || DEFAULT_PROMPTS[taskType] || DEFAULT_PROMPTS.chat;
    
    // Get RAG context if needed
    const ragContext = await getRAGContext(taskType, contextRefs);
    
    // Prepare messages
    const systemMessage = { role: 'system', content: systemPrompt + ragContext };
    const finalMessages = [systemMessage, ...messages];
    
    // Choose model
    const { base, url, maxTokens: modelMaxTokens } = chooseModel(taskType, riskLevel);
    const finalMaxTokens = max_tokens || modelMaxTokens;
    
    // Create cache key
    const cacheKey = crypto.createHash('sha256')
      .update(JSON.stringify({ taskType, finalMessages, finalMaxTokens, temperature }))
      .digest('hex');
    
    // Check cache
    const cached = await getCache(cacheKey);
    if (cached) {
      logger.info('Cache hit', { requestId, taskType });
      return res.json({
        ...cached,
        usage: { ...cached.usage, cache_hit: true }
      });
    }
    
    // Prepare payload
    const payload = {
      model: base,
      messages: finalMessages,
      stream,
      max_tokens: finalMaxTokens,
      temperature
    };
    
    // Make request to model
    const modelResponse = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!modelResponse.ok) {
      throw new Error(`Model request failed: ${modelResponse.status} ${modelResponse.statusText}`);
    }
    
    const responseData = await modelResponse.json();
    
    // Post-filters
    const responseText = responseData.message?.content || '';
    if (postFilters.secrets(responseText)) {
      logger.warn('Secrets detected in response', { requestId, taskType });
      return res.status(500).json({
        error: 'Response blocked: potential secrets detected'
      });
    }
    
    if (postFilters.commands(responseText)) {
      logger.warn('Dangerous commands detected in response', { requestId, taskType });
      return res.status(500).json({
        error: 'Response blocked: dangerous commands detected'
      });
    }
    
    // Format response
    const response = {
      id: `chatcmpl-${requestId}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: base,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseText
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: Math.ceil(allText.length / 4), // Rough estimate
        completion_tokens: Math.ceil(responseText.length / 4),
        total_tokens: Math.ceil((allText + responseText).length / 4),
        cache_hit: false
      }
    };
    
    // Cache response
    await setCache(cacheKey, response);
    
    // Log metrics
    const latency = Date.now() - startTime;
    logger.info('Request completed', {
      requestId,
      taskType,
      model: base,
      latency,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      cacheHit: false
    });
    
    res.json(response);
    
  } catch (error) {
    logger.error('Request failed', { requestId, error: error.message, stack: error.stack });
    res.status(500).json({
      error: 'Internal server error',
      requestId
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      ollama: 'unknown',
      redis: 'unknown'
    }
  };
  
  // Check Ollama
  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/tags`);
    health.services.ollama = ollamaResponse.ok ? 'healthy' : 'unhealthy';
  } catch (err) {
    health.services.ollama = 'unhealthy';
  }
  
  // Check Redis
  if (redisClient) {
    try {
      await redisClient.ping();
      health.services.redis = 'healthy';
    } catch (err) {
      health.services.redis = 'unhealthy';
    }
  } else {
    health.services.redis = 'memory-cache';
  }
  
  const isHealthy = Object.values(health.services).every(status => 
    status === 'healthy' || status === 'memory-cache'
  );
  
  res.status(isHealthy ? 200 : 503).json(health);
});

// Model list endpoint
app.get('/v1/models', async (req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'deepseek-coder:6.7b',
        object: 'model',
        created: 1640995200,
        owned_by: 'deepseek'
      },
      {
        id: 'deepseek-coder-v2:16b',
        object: 'model',
        created: 1640995200,
        owned_by: 'deepseek'
      }
    ]
  });
});

// Load prompts on startup
await loadPrompts();

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`DeepSeek Router running on port ${PORT}`);
  logger.info(`Environment: ${NODE_ENV}`);
  logger.info(`Ollama URL: ${OLLAMA_URL}`);
  logger.info(`Redis URL: ${REDIS_URL}`);
});
