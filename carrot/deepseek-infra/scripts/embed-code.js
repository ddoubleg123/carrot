#!/usr/bin/env node

/**
 * Code Embedding Script
 * Embeds code files and stores them in pgvector for RAG
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'pg';
import { pipeline } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';
const CHUNK_SIZE = 300; // lines of code
const OVERLAP = 50; // lines overlap between chunks

// Database connection
const dbClient = createClient({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'deepseek_rag',
  user: process.env.DB_USER || 'deepseek',
  password: process.env.DB_PASSWORD || 'deepseek_password',
});

// Initialize embedding pipeline
let embeddingPipeline;
const initEmbedding = async () => {
  if (!embeddingPipeline) {
    console.log('Loading embedding model...');
    embeddingPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL);
  }
  return embeddingPipeline;
};

// Generate embedding for text
const generateEmbedding = async (text) => {
  const pipeline = await initEmbedding();
  const result = await pipeline(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
};

// Chunk code by functions/classes
const chunkCode = (content, filePath) => {
  const lines = content.split('\n');
  const chunks = [];
  
  // Simple chunking by line count with overlap
  for (let i = 0; i < lines.length; i += CHUNK_SIZE - OVERLAP) {
    const endLine = Math.min(i + CHUNK_SIZE, lines.length);
    const chunkLines = lines.slice(i, endLine);
    const chunkContent = chunkLines.join('\n');
    
    if (chunkContent.trim().length > 0) {
      chunks.push({
        startLine: i + 1,
        endLine: endLine,
        content: chunkContent,
        chunkType: detectChunkType(chunkContent, filePath),
        language: getLanguageFromPath(filePath)
      });
    }
  }
  
  return chunks;
};

// Detect chunk type (function, class, module, etc.)
const detectChunkType = (content, filePath) => {
  if (content.includes('function ') || content.includes('const ') || content.includes('export ')) {
    return 'function';
  }
  if (content.includes('class ') || content.includes('interface ')) {
    return 'class';
  }
  if (content.includes('import ') || content.includes('export ')) {
    return 'module';
  }
  return 'code';
};

// Get language from file extension
const getLanguageFromPath = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.cpp': 'cpp',
    '.c': 'c',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.sh': 'bash',
    '.sql': 'sql',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.txt': 'text'
  };
  return languageMap[ext] || 'unknown';
};

// Process a single file
const processFile = async (filePath, repository) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const chunks = chunkCode(content, filePath);
    
    console.log(`Processing ${filePath}: ${chunks.length} chunks`);
    
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);
      
      await dbClient.query(`
        INSERT INTO code_chunks (repository, file_path, start_line, end_line, content, chunk_type, language, embedding, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (repository, file_path, start_line) DO UPDATE SET
          content = EXCLUDED.content,
          chunk_type = EXCLUDED.chunk_type,
          language = EXCLUDED.language,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
      `, [
        repository,
        filePath,
        chunk.startLine,
        chunk.endLine,
        chunk.content,
        chunk.chunkType,
        chunk.language,
        `[${embedding.join(',')}]`, // Convert array to PostgreSQL array format
        JSON.stringify({
          fileSize: content.length,
          chunkSize: chunk.content.length,
          processedAt: new Date().toISOString()
        })
      ]);
    }
    
    return chunks.length;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return 0;
  }
};

// Recursively find code files
const findCodeFiles = async (dir, extensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.go', '.rs']) => {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip common non-code directories
        if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
          const subFiles = await findCodeFiles(fullPath, extensions);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return files;
};

// Main function
const main = async () => {
  const repository = process.argv[2] || 'carrot';
  const sourceDir = process.argv[3] || process.cwd();
  
  console.log(`Embedding code from ${sourceDir} for repository: ${repository}`);
  
  try {
    await dbClient.connect();
    console.log('Connected to database');
    
    // Find all code files
    const files = await findCodeFiles(sourceDir);
    console.log(`Found ${files.length} code files`);
    
    let totalChunks = 0;
    let processedFiles = 0;
    
    for (const file of files) {
      const chunks = await processFile(file, repository);
      totalChunks += chunks;
      processedFiles++;
      
      if (processedFiles % 10 === 0) {
        console.log(`Processed ${processedFiles}/${files.length} files, ${totalChunks} chunks`);
      }
    }
    
    console.log(`✅ Embedding complete!`);
    console.log(`- Files processed: ${processedFiles}`);
    console.log(`- Total chunks: ${totalChunks}`);
    console.log(`- Repository: ${repository}`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { processFile, findCodeFiles, generateEmbedding };
