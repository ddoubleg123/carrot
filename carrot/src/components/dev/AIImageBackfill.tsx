"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Image, CheckCircle, XCircle } from 'lucide-react'

interface BackfillResult {
  id: string
  title: string
  imageUrl?: string
  status: 'success' | 'failed'
  error?: string
}

interface BackfillResponse {
  success: boolean
  patch: string
  processed: number
  successful: number
  failed: number
  results: BackfillResult[]
  errors: BackfillResult[]
}

interface AIImageBackfillProps {
  patchHandle: string
}

export default function AIImageBackfill({ patchHandle }: AIImageBackfillProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<BackfillResponse | null>(null)
  const [stats, setStats] = useState<any>(null)

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/dev/backfill-ai-images?patchHandle=${patchHandle}`)
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const triggerBackfill = async (limit: number = 5, forceRegenerate: boolean = false) => {
    setIsLoading(true)
    setResults(null)

    try {
      const response = await fetch('/api/dev/backfill-ai-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patchHandle,
          limit,
          forceRegenerate
        })
      })

      const data = await response.json()
      setResults(data)
      
      // Reload stats after backfill
      await loadStats()
      
    } catch (error) {
      console.error('Backfill failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load stats on mount
  useEffect(() => {
    loadStats()
  }, [patchHandle])

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          AI Image Backfill
        </CardTitle>
        <CardDescription>
          Generate AI images for discovered content in the {patchHandle} patch
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.stats.total}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.stats.withHero}</div>
              <div className="text-sm text-gray-600">With Images</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.stats.withoutHero}</div>
              <div className="text-sm text-gray-600">Without Images</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.stats.aiGenerated}</div>
              <div className="text-sm text-gray-600">AI Generated</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => triggerBackfill(1, false)}
            disabled={isLoading}
            variant="primary"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
            Generate 1 Image
          </Button>
          
          <Button 
            onClick={() => triggerBackfill(5, false)}
            disabled={isLoading}
            variant="outline"
          >
            Generate 5 Images
          </Button>
          
          <Button 
            onClick={() => triggerBackfill(10, true)}
            disabled={isLoading}
            variant="outline"
          >
            Regenerate All
          </Button>
          
          <Button 
            onClick={loadStats}
            disabled={isLoading}
            variant="ghost"
          >
            Refresh Stats
          </Button>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant={results.successful > 0 ? "default" : "destructive"}>
                {results.successful} Successful
              </Badge>
              {results.failed > 0 && (
                <Badge variant="destructive">
                  {results.failed} Failed
                </Badge>
              )}
            </div>

            {/* Successful Results */}
            {results.results.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-green-700">✅ Successful Generations</h4>
                <div className="space-y-2">
                  {results.results.map((result) => (
                    <div key={result.id} className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{result.title}</span>
                      {result.imageUrl && (
                        <img 
                          src={result.imageUrl} 
                          alt={result.title}
                          className="w-8 h-8 object-cover rounded"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed Results */}
            {results.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-red-700">❌ Failed Generations</h4>
                <div className="space-y-2">
                  {results.errors.map((error) => (
                    <div key={error.id} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm">{error.title}</span>
                      <span className="text-xs text-red-600">{error.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
