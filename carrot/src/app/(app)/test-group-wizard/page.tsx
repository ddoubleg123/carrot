'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  Bookmark, 
  Link2, 
  MoreHorizontal,
  Search,
  Filter,
  SortAsc,
  Clock,
  Globe,
  User,
  Calendar,
  Play,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { DiscoveredItem } from '@/types/discovered-content'

// Design tokens from Carrot standards
const TOKENS = {
  colors: {
    action: '#FF6A00',
    civic: '#0A5AFF', 
    ink: '#0B0B0F',
    slate: '#60646C',
    line: '#E6E8EC',
    surface: '#FFFFFF',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
  spacing: {
    xs: '4px',
    sm: '8px', 
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  radii: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    xxl: '20px',
  },
  motion: {
    fast: '120ms',
    normal: '160ms',
    slow: '180ms',
  },
  typography: {
    h1: '32px',
    h2: '28px',
    h3: '24px',
    h4: '20px',
    body: '16px',
    caption: '12px',
  }
}

// Mock data for testing
const mockDiscoveredItems: DiscoveredItem[] = [
  {
    id: '1',
    title: 'Houston Oilers: The Complete History',
    url: 'https://example.com/houston-oilers-history',
    type: 'article',
    matchPct: 0.95,
    status: 'ready',
    media: {
      hero: 'https://ui-avatars.com/api/?name=Houston%20Oilers&background=FF6A00&color=fff&size=800&format=png&bold=true',
      gallery: [],
    },
    content: {
      summary150: 'A comprehensive look at the Houston Oilers franchise from its founding to present day, covering key players, championships, and memorable moments.',
      keyPoints: ['Founded in 1960', 'Two AFL championships', 'Warren Moon era', 'Relocated to Tennessee'],
      readingTimeMin: 8
    },
    meta: {
      sourceDomain: 'nfl.com',
      author: 'NFL Historical Society',
      publishDate: '2024-01-15'
    }
  },
  {
    id: '2', 
    title: 'Warren Moon: Hall of Fame Quarterback',
    url: 'https://example.com/warren-moon',
    type: 'video',
    matchPct: 0.89,
    status: 'ready',
    media: {
      hero: 'https://ui-avatars.com/api/?name=Warren%20Moon&background=0A5AFF&color=fff&size=800&format=png&bold=true',
      gallery: [],
    },
    content: {
      summary150: 'Documentary about Warren Moon\'s incredible career with the Houston Oilers and his journey to the Pro Football Hall of Fame.',
      keyPoints: ['Hall of Fame QB', 'Houston Oilers legend', 'AFL record holder', 'Community leader'],
      readingTimeMin: 15
    },
    meta: {
      sourceDomain: 'youtube.com',
      author: 'NFL Films',
      publishDate: '2024-02-01'
    }
  },
  {
    id: '3',
    title: 'Earl Campbell: The Tyler Rose',
    url: 'https://example.com/earl-campbell',
    type: 'article',
    matchPct: 0.87,
    status: 'ready',
    media: {
      hero: 'https://ui-avatars.com/api/?name=Earl%20Campbell&background=10B981&color=fff&size=800&format=png&bold=true',
      gallery: [],
    },
    content: {
      summary150: 'The legendary running back who dominated the NFL with his powerful running style and became one of the most beloved Oilers players.',
      keyPoints: ['Heisman Trophy winner', 'NFL MVP 1979', 'Power running style', 'Tyler Rose nickname'],
      readingTimeMin: 6
    },
    meta: {
      sourceDomain: 'espn.com',
      author: 'Sports Illustrated',
      publishDate: '2024-01-20'
    }
  }
]

// Youth sports domain tags for whitelist
const YOUTH_SPORTS_TAGS = [
  'cheerleading', 'routines', 'drills', 'choreography', 
  'practice', 'team building', 'safety', 'sideline', 'fundraising'
]

// Available tags for selection
const AVAILABLE_TAGS = [
  'nfl history', 'houston sports', 'warren moon', 'earl campbell', 
  'football legacy', 'afl championship', 'oilers history', 'nfl legends',
  'quarterback', 'running back', 'hall of fame', 'pro football',
  'houston oilers', 'tennessee titans', 'american football', 'sports history',
  'team history', 'franchise', 'championship', 'mvp'
]

const AVAILABLE_CATEGORIES = [
  'Sports History',
  'NFL Teams', 
  'Hall of Fame',
  'Houston Sports',
  'American Football',
  'Team History',
  'Player Profiles',
  'Championship History'
]

export default function TestGroupWizardPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [groupName, setGroupName] = useState('Houston Oilers')
  const [groupDescription, setGroupDescription] = useState('A community for Houston Oilers fans to discuss team history, players, and memorable moments.')
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // Discovery state
  const [discoveredItems, setDiscoveredItems] = useState<DiscoveredItem[]>([])
  const [isDiscovering, setIsDiscovering] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [filterType, setFilterType] = useState<'all' | 'article' | 'video' | 'post'>('all')
  const [sortBy, setSortBy] = useState<'top' | 'new' | 'shortest'>('top')
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | '30d'>('7d')

  // Simulate discovery process
  useEffect(() => {
    if (isDiscovering) {
      // Simulate streaming items
      const interval = setInterval(() => {
        setDiscoveredItems(prev => {
          const newItem = mockDiscoveredItems[Math.floor(Math.random() * mockDiscoveredItems.length)]
          return [newItem, ...prev.slice(0, 9)] // Keep max 10 items
        })
        setLastUpdate(new Date())
      }, 3000)
      
      return () => clearInterval(interval)
    }
  }, [isDiscovering])

  const handleContinue = async () => {
    if (currentStep === 2) {
      // Optimistic navigation
      setCurrentStep(3)
      setIsSaving(true)
      setSaveStatus('saving')
      
      // Simulate save
      setTimeout(() => {
        setIsSaving(false)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }, 500)
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    setCurrentStep(prev => prev - 1)
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Test Group Wizard & Discovery
          </h1>
          <p className="text-gray-600">
            Testing the Create Group wizard and Discovering content block
          </p>
        </div>

        {/* Wizard Shell */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Create Group</CardTitle>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                Step {currentStep} of 3
                <div className="flex gap-1">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`w-2 h-2 rounded-full ${
                        step <= currentStep ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Group Details</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Group Name
                  </label>
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="Describe your group"
                    className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Topics */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Choose Topics</h3>
                
                {/* Tags Section */}
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-3">
                    Tags — select all that apply
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TAGS.map((tag) => (
                      <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        className={`cursor-pointer transition-all ${
                          selectedTags.includes(tag) 
                            ? 'bg-orange-500 text-white hover:bg-orange-600' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Categories Section */}
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-3">
                    Categories — select all that apply
                  </h4>
                  <div className="space-y-2">
                    {AVAILABLE_CATEGORIES.map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={category}
                          checked={selectedCategories.includes(category)}
                          onCheckedChange={() => toggleCategory(category)}
                        />
                        <label 
                          htmlFor={category}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {category}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Status */}
                {saveStatus === 'saving' && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving selections…
                  </div>
                )}
                {saveStatus === 'saved' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Saved
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Review</h3>
                
                <div className="space-y-4">
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Group Details</h4>
                      <Button variant="ghost" size="sm" className="text-orange-500 hover:text-orange-600">
                        Edit
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600">{groupName}</p>
                    <p className="text-sm text-gray-600">{groupDescription}</p>
                  </div>

                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Tags & Categories</h4>
                      <Button variant="ghost" size="sm" className="text-orange-500 hover:text-orange-600">
                        Edit
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {selectedTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-sm text-gray-600">
                        Categories: {selectedCategories.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              
              <Button
                onClick={handleContinue}
                disabled={currentStep === 1 && (!groupName || !groupDescription)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600"
              >
                {currentStep === 3 ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Create Group
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Discovering Content Block */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">Discovering content</h2>
                {isDiscovering && (
                  <>
                    <Badge className="bg-orange-500 text-white">
                      LIVE
                    </Badge>
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  </>
                )}
              </div>
              <div className="text-sm text-gray-500" aria-live="polite">
                Updated {getTimeAgo(lastUpdate)} • {discoveredItems.length} new
              </div>
            </div>
            <p className="text-gray-600">
              We're actively finding posts, videos, and drills that match this group. New items will appear here.
            </p>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="article">Articles</option>
                  <option value="video">Videos</option>
                  <option value="post">Posts</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <SortAsc className="w-4 h-4 text-gray-500" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                >
                  <option value="top">Top</option>
                  <option value="new">New</option>
                  <option value="shortest">Shortest read</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                >
                  <option value="24h">24h</option>
                  <option value="7d">7d</option>
                  <option value="30d">30d</option>
                </select>
              </div>

              <div className="text-sm text-gray-500 ml-auto">
                {discoveredItems.length} items • filtered
              </div>
            </div>

            {/* Discovery Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {discoveredItems.map((item, index) => (
                <DiscoveryCard key={item.id} item={item} isNew={index === 0} />
              ))}
            </div>

            {/* Empty State */}
            {discoveredItems.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results yet</h3>
                <p className="text-gray-500 mb-4">Connect sources or check back soon.</p>
                <Button variant="outline">Connect sources</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Discovery Card Component
function DiscoveryCard({ item, isNew }: { item: DiscoveredItem; isNew?: boolean }) {
  const [isHighlighted, setIsHighlighted] = useState(isNew)

  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => setIsHighlighted(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isNew])

  const getTypeIcon = () => {
    switch (item.type) {
      case 'video': return <Play size={16} />
      case 'pdf': return <FileText size={16} />
      case 'article': return <FileText size={16} />
      case 'image': return <ImageIcon size={16} />
      case 'text': return <FileText size={16} />
      default: return <FileText size={16} />
    }
  }

  const getTypeLabel = () => {
    switch (item.type) {
      case 'video': return 'Video'
      case 'pdf': return 'PDF'
      case 'article': return 'Article'
      case 'image': return 'Image'
      case 'text': return 'Text'
      default: return 'Content'
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      })
    } catch {
      return null
    }
  }

  const formatReadingTime = (minutes?: number) => {
    if (!minutes) return null
    if (minutes < 1) return '< 1 min'
    if (minutes === 1) return '1 min'
    return `${Math.round(minutes)} min`
  }

  return (
    <Card 
      className={`rounded-2xl border border-[#E6E8EC] bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
        isHighlighted ? 'animate-pulse bg-orange-50 border-orange-200' : ''
      }`}
    >
      {/* Hero Image */}
      <div className="aspect-[16/9] overflow-hidden rounded-t-2xl relative bg-gray-100">
        <img
          src={item.media.hero}
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Type Badge */}
        <div className="absolute top-3 left-3">
          <Badge className="bg-white/90 text-gray-900 border-0 flex items-center gap-1.5">
            {getTypeIcon()}
            {getTypeLabel()}
          </Badge>
        </div>

        {/* Match Percentage */}
        {item.matchPct && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-white/90 text-gray-900 border-0">
              Match: {Math.round(item.matchPct * 100)}%
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-5">
        {/* Meta Row */}
        <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
          <div className="flex items-center gap-1.5">
            <Globe size={12} />
            <span className="truncate max-w-[100px]">{item.meta.sourceDomain}</span>
          </div>
          {item.meta.publishDate && (
            <div className="flex items-center gap-1.5">
              <Calendar size={12} />
              <span>{formatDate(item.meta.publishDate)}</span>
            </div>
          )}
          {item.content.readingTimeMin && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              <span>{formatReadingTime(item.content.readingTimeMin)}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold leading-6 text-gray-900 mb-2 line-clamp-2">
          {item.title}
        </h3>

        {/* Summary */}
        {item.content.summary150 && (
          <p className="text-gray-700 text-sm leading-relaxed mb-3 line-clamp-2">
            {item.content.summary150}
          </p>
        )}

        {/* Key Points */}
        {item.content.keyPoints && item.content.keyPoints.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.content.keyPoints.slice(0, 3).map((point, index) => (
              <Badge key={index} variant="outline" className="text-xs rounded-full border-gray-200 text-gray-700">
                {point}
              </Badge>
            ))}
          </div>
        )}

        {/* Action Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => item.url && window.open(item.url, '_blank')}
              disabled={!item.url}
            >
              <ExternalLink size={12} className="mr-1" />
              Open
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 px-3 text-xs"
            >
              <Link2 size={12} className="mr-1" />
              Attach
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
            >
              <Bookmark size={12} />
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
          >
            <MoreHorizontal size={12} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
