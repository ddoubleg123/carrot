#!/usr/bin/env node

/**
 * RAG Retrieval Script
 * Retrieves relevant code chunks for RAG tasks
 */

import { createClient } from 'pg';
import { pipeline } from '@xenova/transformers';

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
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
  }
  return embeddingPipeline;
};

// Generate embedding for query
const generateEmbedding = async (text) => {
  const pipeline = await initEmbedding();
  const result = await pipeline(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
};

// Search code chunks
const searchCodeChunks = async (query, options = {}) => {
  const {
    repository = null,
    fileFilter = null,
    chunkType = null,
    limit = 3
  } = options;

  try {
    await dbClient.connect();
    
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    
    // Search using pgvector
    const result = await dbClient.query(`
      SELECT 
        repository,
        file_path,
        start_line,
        end_line,
        content,
        chunk_type,
        language,
        1 - (embedding <=> $1) AS similarity,
        metadata
      FROM code_chunks
      WHERE 
        ($2::varchar IS NULL OR repository = $2)
        AND ($3::text IS NULL OR file_path ILIKE '%' || $3 || '%')
        AND ($4::varchar IS NULL OR chunk_type = $4)
      ORDER BY embedding <=> $1
      LIMIT $5
    `, [JSON.stringify(queryEmbedding), repository, fileFilter, chunkType, limit]);

    return result.rows;
  } catch (error) {
    console.error('Error searching code chunks:', error);
    return [];
  } finally {
    await dbClient.end();
  }
};

// Format chunks for RAG context
const formatChunksForRAG = (chunks) => {
  if (!chunks || chunks.length === 0) {
    return 'No relevant code context found.';
  }

  let context = '--- CODE CONTEXT ---\n';
  
  chunks.forEach((chunk, index) => {
    context += `\n[${index + 1}] File: ${chunk.file_path} (lines ${chunk.start_line}-${chunk.end_line})\n`;
    context += `Type: ${chunk.chunk_type} | Language: ${chunk.language}\n`;
    context += `Similarity: ${(chunk.similarity * 100).toFixed(1)}%\n`;
    context += `\n\`\`\`${chunk.language}\n${chunk.content}\n\`\`\`\n`;
  });
  
  context += '\n--- END CONTEXT ---\n';
  context += '\nUse ONLY the provided code context above. If the information is not in the context, say so.';
  
  return context;
};

// Main function
const main = async () => {
  const query = process.argv[2];
  const repository = process.argv[3] || null;
  
  if (!query) {
    console.log('Usage: node rag-retrieval.js "query" [repository]');
    console.log('Example: node rag-retrieval.js "How to use Button component" carrot');
    process.exit(1);
  }
  
  console.log(`Searching for: "${query}"`);
  if (repository) {
    console.log(`Repository: ${repository}`);
  }
  
  const chunks = await searchCodeChunks(query, { repository });
  
  if (chunks.length === 0) {
    console.log('No relevant chunks found.');
    return;
  }
  
  console.log(`\nFound ${chunks.length} relevant chunks:`);
  chunks.forEach((chunk, index) => {
    console.log(`\n${index + 1}. ${chunk.file_path} (${chunk.chunk_type})`);
    console.log(`   Lines: ${chunk.start_line}-${chunk.end_line}`);
    console.log(`   Similarity: ${(chunk.similarity * 100).toFixed(1)}%`);
    console.log(`   Preview: ${chunk.content.substring(0, 100)}...`);
  });
  
  console.log('\n--- RAG Context Format ---');
  console.log(formatChunksForRAG(chunks));
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { searchCodeChunks, formatChunksForRAG, generateEmbedding };
