-- DeepSeek Coder RAG Database Schema
-- Phase 1: Code RAG with pgvector

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Code chunks table
CREATE TABLE IF NOT EXISTS code_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    content TEXT NOT NULL,
    chunk_type VARCHAR(50) DEFAULT 'function', -- function, class, module, etc.
    language VARCHAR(50) NOT NULL,
    embedding VECTOR(384), -- bge-small-en embedding dimension
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunks table (for Phase 3)
CREATE TABLE IF NOT EXISTS doc_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(255) NOT NULL, -- policy, faq, etc.
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(384),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_code_chunks_repo ON code_chunks(repository);
CREATE INDEX IF NOT EXISTS idx_code_chunks_file ON code_chunks(file_path);
CREATE INDEX IF NOT EXISTS idx_code_chunks_type ON code_chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_code_chunks_language ON code_chunks(language);
CREATE INDEX IF NOT EXISTS idx_code_chunks_embedding ON code_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_source ON doc_chunks(source);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding ON doc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function to search code chunks
CREATE OR REPLACE FUNCTION search_code_chunks(
    query_embedding VECTOR(384),
    repo_filter VARCHAR(255) DEFAULT NULL,
    file_filter TEXT DEFAULT NULL,
    chunk_type_filter VARCHAR(50) DEFAULT NULL,
    limit_count INTEGER DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    repository VARCHAR(255),
    file_path TEXT,
    start_line INTEGER,
    end_line INTEGER,
    content TEXT,
    chunk_type VARCHAR(50),
    language VARCHAR(50),
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cc.id,
        cc.repository,
        cc.file_path,
        cc.start_line,
        cc.end_line,
        cc.content,
        cc.chunk_type,
        cc.language,
        1 - (cc.embedding <=> query_embedding) AS similarity,
        cc.metadata
    FROM code_chunks cc
    WHERE 
        (repo_filter IS NULL OR cc.repository = repo_filter)
        AND (file_filter IS NULL OR cc.file_path ILIKE '%' || file_filter || '%')
        AND (chunk_type_filter IS NULL OR cc.chunk_type = chunk_type_filter)
    ORDER BY cc.embedding <=> query_embedding
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to search document chunks
CREATE OR REPLACE FUNCTION search_doc_chunks(
    query_embedding VECTOR(384),
    source_filter VARCHAR(255) DEFAULT NULL,
    limit_count INTEGER DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    source VARCHAR(255),
    title TEXT,
    content TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        dc.source,
        dc.title,
        dc.content,
        1 - (dc.embedding <=> query_embedding) AS similarity,
        dc.metadata
    FROM doc_chunks dc
    WHERE 
        (source_filter IS NULL OR dc.source = source_filter)
    ORDER BY dc.embedding <=> query_embedding
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for testing
INSERT INTO code_chunks (repository, file_path, start_line, end_line, content, chunk_type, language, metadata) VALUES
('carrot', 'src/components/Button.tsx', 1, 20, 'import React from "react";\ninterface ButtonProps {\n  children: React.ReactNode;\n  onClick?: () => void;\n  variant?: "primary" | "secondary";\n}\n\nexport const Button: React.FC<ButtonProps> = ({ children, onClick, variant = "primary" }) => {\n  return (\n    <button\n      className={`btn btn-${variant}`}\n      onClick={onClick}\n    >\n      {children}\n    </button>\n  );\n};', 'component', 'typescript', '{"tags": ["ui", "component"], "complexity": "low"}'),
('carrot', 'src/hooks/useLocalStorage.ts', 1, 30, 'import { useState, useEffect } from "react";\n\nexport function useLocalStorage<T>(key: string, initialValue: T) {\n  const [storedValue, setStoredValue] = useState<T>(() => {\n    try {\n      const item = window.localStorage.getItem(key);\n      return item ? JSON.parse(item) : initialValue;\n    } catch (error) {\n      console.error(`Error reading localStorage key "${key}":`, error);\n      return initialValue;\n    }\n  });\n\n  const setValue = (value: T | ((val: T) => T)) => {\n    try {\n      const valueToStore = value instanceof Function ? value(storedValue) : value;\n      setStoredValue(valueToStore);\n      window.localStorage.setItem(key, JSON.stringify(valueToStore));\n    } catch (error) {\n      console.error(`Error setting localStorage key "${key}":`, error);\n    }\n  };\n\n  return [storedValue, setValue] as const;\n}', 'hook', 'typescript', '{"tags": ["hook", "storage"], "complexity": "medium"}');

-- Insert sample document chunks
INSERT INTO doc_chunks (source, title, content, metadata) VALUES
('policy', 'Code Review Guidelines', 'All code changes must be reviewed by at least one senior developer. Focus on security, performance, and maintainability. Use automated tools for linting and testing.', '{"category": "development", "priority": "high"}'),
('faq', 'How to Deploy', 'Deploy to staging first, then production. Use feature flags for gradual rollouts. Monitor metrics and logs during deployment.', '{"category": "deployment", "priority": "medium"}');

-- Create user for the application
CREATE USER IF NOT EXISTS deepseek_user WITH PASSWORD 'deepseek_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON code_chunks TO deepseek_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON doc_chunks TO deepseek_user;
GRANT USAGE ON SCHEMA public TO deepseek_user;
