'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BookOpen, 
  ExternalLink, 
  Calendar, 
  User, 
  Search, 
  Filter,
  FileText,
  Globe,
  Video,
  Image,
  Download
} from 'lucide-react';

interface StudyRecordItem {
  id: string;
  sourceTitle: string;
  sourceUrl?: string;
  sourceAuthor?: string;
  sourceType: string;
  content: string;
  tags: string[];
  confidence: number;
  createdAt: string;
  fedBy: string;
}

interface StudyRecordProps {
  agentId: string;
  agentName: string;
}

export default function StudyRecord({ agentId, agentName }: StudyRecordProps) {
  const [studyItems, setStudyItems] = useState<StudyRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'confidence'>('newest');

  useEffect(() => {
    loadStudyRecord();
  }, [agentId]);

  const loadStudyRecord = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/agents/${agentId}/memories`);
      if (response.ok) {
        const data = await response.json();
        setStudyItems(data.memories || []);
      }
    } catch (error) {
      console.error('Error loading study record:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = studyItems
    .filter(item => {
      const matchesSearch = !searchQuery || 
        item.sourceTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sourceAuthor?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = sourceTypeFilter === 'all' || item.sourceType === sourceTypeFilter;
      
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'confidence':
          return b.confidence - a.confidence;
        default:
          return 0;
      }
    });

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'url':
        return <Globe className="w-4 h-4" />;
      case 'file':
        return <FileText className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  const getSourceTypeLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'url':
        return 'Website';
      case 'file':
        return 'Document';
      case 'video':
        return 'Video';
      case 'image':
        return 'Image';
      case 'manual':
        return 'Manual Entry';
      default:
        return sourceType;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportStudyRecord = () => {
    const csvContent = [
      ['Title', 'Source URL', 'Author', 'Type', 'Date Studied', 'Tags', 'Confidence'],
      ...filteredItems.map(item => [
        item.sourceTitle,
        item.sourceUrl || '',
        item.sourceAuthor || '',
        getSourceTypeLabel(item.sourceType),
        formatDate(item.createdAt),
        item.tags.join('; '),
        item.confidence.toString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agentName}-study-record.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Study Record
          </CardTitle>
          <CardDescription>
            Loading {agentName}'s study history...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading study record...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Study Record
            </CardTitle>
            <CardDescription>
              Complete record of content studied by {agentName} ({studyItems.length} items)
            </CardDescription>
          </div>
          <Button onClick={exportStudyRecord} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by title, content, or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="url">Websites</SelectItem>
              <SelectItem value="file">Documents</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="manual">Manual Entries</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="confidence">High Confidence</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Study Items */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {studyItems.length === 0 
              ? `${agentName} hasn't studied any content yet.`
              : 'No items match your search criteria.'
            }
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getSourceIcon(item.sourceType)}
                      <h4 className="font-medium text-sm truncate">{item.sourceTitle}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {getSourceTypeLabel(item.sourceType)}
                      </Badge>
                      <Badge 
                        variant={item.confidence >= 0.8 ? "default" : "outline"}
                        className="text-xs"
                      >
                        {Math.round(item.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    
                    {item.sourceAuthor && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <User className="w-3 h-3" />
                        <span>{item.sourceAuthor}</span>
                      </div>
                    )}
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {item.content}
                    </p>
                    
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {item.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Studied {formatDate(item.createdAt)}</span>
                      </div>
                      <span>by {item.fedBy}</span>
                    </div>
                  </div>
                  
                  {item.sourceUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(item.sourceUrl, '_blank')}
                      className="flex-shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
