'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, BookOpen, Calendar, User, Tag } from 'lucide-react'
import { DiscoveredItem } from '@/types/discovered-content'

// Mock data for "Houston Oilers: The Complete History" based on the console logs
const testContent: DiscoveredItem = {
  id: "test-houston-oilers-complete-history",
  title: "Houston Oilers: The Complete History",
  url: "https://example.com/houston-oilers-complete-history",
  type: "article",
  matchPct: 0.95,
  status: "pending_audit",
  media: {
    hero: "https://ui-avatars.com/api/?name=Houston%20Oilers&background=FF6A00&color=fff&size=800&format=png&bold=true",
    gallery: [],
    videoThumb: undefined,
    pdfPreview: undefined
  },
  content: {
    summary150: "The Houston Oilers were a professional American football team that played in the American Football League (AFL) and later the National Football League (NFL) from 1960 to 1996. The team was known for its high-powered offense and memorable players like Warren Moon and Earl Campbell.",
    keyPoints: [
      "Founded in 1960 as charter member of AFL",
      "Won two AFL championships (1960, 1961)", 
      "Notable players: Warren Moon, Earl Campbell, Bruce Matthews",
      "Relocated to Tennessee in 1997, becoming the Titans"
    ],
    notableQuote: "The Houston Oilers left an indelible mark on professional football history.",
    readingTimeMin: 10
  },
  meta: {
    sourceDomain: "example.com",
    author: "NFL Historical Society",
    publishDate: "2024-01-15"
  }
}

export default function TestContentPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Test Content Page
          </h1>
          <p className="text-gray-600">
            Testing display of discovered content: "{testContent.title}"
          </p>
        </div>

        <ContentDisplayCard content={testContent} />

        {/* Debug Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 p-4 rounded-lg">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(testContent, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ContentDisplayCard({ content }: { content: DiscoveredItem }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {content.type.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {Math.round((content.matchPct || 0) * 100)}% match
              </Badge>
              <Badge 
                variant={content.status === 'pending_audit' ? 'destructive' : 'default'}
                className="text-xs"
              >
                {content.status === 'pending_audit' ? 'Pending Review' : content.status.replace('_', ' ')}
              </Badge>
            </div>
            <CardTitle className="text-2xl leading-tight mb-3">
              {content.title}
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Media Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Content Preview
          </h3>
          
          {/* Placeholder for individualized imagery */}
          <div className="bg-gradient-to-r from-blue-600 to-red-600 rounded-lg p-8 text-white text-center">
            <div className="text-4xl mb-4">🏈</div>
            <p className="text-lg font-semibold mb-2">Houston Oilers</p>
            <p className="text-sm opacity-90">Team Logo & Branding</p>
            <p className="text-xs mt-2 opacity-75">
              TODO: Generate individualized imagery based on content
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              onClick={() => window.open(content.url, '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
              Open Original
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Tag className="w-4 h-4" />
              Attach to Patch
            </button>
          </div>
        </div>

        {/* Content Summary */}
        {content.content.summary150 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Summary</h3>
            <p className="text-gray-700 leading-relaxed">
              {content.content.summary150}
            </p>
          </div>
        )}

        {/* Key Points */}
        {content.content.keyPoints && content.content.keyPoints.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Key Points</h3>
            <ul className="space-y-2">
              {content.content.keyPoints.map((point: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></span>
                  <span className="text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notable Quote */}
        {content.content.notableQuote && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Notable Quote</h3>
            <blockquote className="text-gray-700 italic border-l-2 border-orange-500 pl-4">
              "{content.content.notableQuote}"
            </blockquote>
          </div>
        )}

        {/* Metadata */}
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-lg font-semibold">Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {content.meta.author && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Author:</span>
                <span className="font-medium">{content.meta.author}</span>
              </div>
            )}
            {content.meta.publishDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Published:</span>
                <span className="font-medium">
                  {new Date(content.meta.publishDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {content.content.readingTimeMin && (
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Reading time:</span>
                <span className="font-medium">{content.content.readingTimeMin} minutes</span>
              </div>
            )}
            {content.meta.sourceDomain && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Source:</span>
                <span className="font-medium">{content.meta.sourceDomain}</span>
              </div>
            )}
          </div>
        </div>

        {/* URL Information */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 text-sm">
            <ExternalLink className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Source URL:</span>
            <a 
              href={content.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {content.url}
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
