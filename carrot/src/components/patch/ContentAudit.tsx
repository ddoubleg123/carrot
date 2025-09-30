'use client';

import { useState } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface AuditResult {
  auditScore: number;
  relevanceScore: number;
  qualityScore: number;
  accuracyScore: number;
  recommendation: 'approve' | 'reject' | 'revise';
  notes: string;
  improvements: string[];
  strengths: string[];
  concerns: string[];
}

interface ContentAuditProps {
  patchId: string;
  patchHandle: string;
}

export default function ContentAudit({ patchId, patchHandle }: ContentAuditProps) {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const triggerBatchAudit = async () => {
    setIsAuditing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ai/batch-audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patchId,
          limit: 5
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger batch audit');
      }

      const result = await response.json();
      setAuditResults(result.results || []);
      
      // Refresh the page to show updated content status
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsAuditing(false);
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'approve': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'reject': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'revise': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'approve': return 'bg-green-100 text-green-800 border-green-200';
      case 'reject': return 'bg-red-100 text-red-800 border-red-200';
      case 'revise': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Content Audit</h3>
        </div>
        
        <button
          onClick={triggerBatchAudit}
          disabled={isAuditing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAuditing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Shield className="h-4 w-4" />
          )}
          {isAuditing ? 'Auditing...' : 'Audit Content'}
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Review and audit discovered content for quality, relevance, and accuracy using AI.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {auditResults.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Latest Audit Results</h4>
          {auditResults.map((result, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              {result.success ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getRecommendationIcon(result.result.recommendation)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRecommendationColor(result.result.recommendation)}`}>
                        {result.result.recommendation.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`font-medium ${getScoreColor(result.result.auditScore)}`}>
                        Overall: {result.result.auditScore}/10
                      </span>
                      <span className={`font-medium ${getScoreColor(result.result.relevanceScore)}`}>
                        Relevance: {result.result.relevanceScore}/10
                      </span>
                      <span className={`font-medium ${getScoreColor(result.result.qualityScore)}`}>
                        Quality: {result.result.qualityScore}/10
                      </span>
                      <span className={`font-medium ${getScoreColor(result.result.accuracyScore)}`}>
                        Accuracy: {result.result.accuracyScore}/10
                      </span>
                    </div>
                  </div>

                  {result.result.notes && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-700">{result.result.notes}</p>
                    </div>
                  )}

                  {result.result.strengths.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-green-700 mb-1">Strengths:</h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {result.result.strengths.map((strength: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.result.concerns.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-red-700 mb-1">Concerns:</h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {result.result.concerns.map((concern: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span>{concern}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.result.improvements.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-blue-700 mb-1">Improvements:</h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {result.result.improvements.map((improvement: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Audit failed: {result.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {auditResults.length === 0 && !isAuditing && (
        <div className="text-center py-8 text-gray-500">
          <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No audit results yet. Click "Audit Content" to start reviewing discovered content.</p>
        </div>
      )}
    </div>
  );
}
