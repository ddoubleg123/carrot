'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Image, Video, File, Search, Grid, List, Filter } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  type: 'pdf' | 'image' | 'video' | 'text';
  url: string;
  size?: string;
  uploadedAt: Date;
  uploadedBy: {
    name: string;
    username: string;
  };
  tags: string[];
}

interface Patch {
  id: string;
  name: string;
}

interface DocumentsViewProps {
  patch: Patch;
}

export default function DocumentsView({ patch }: DocumentsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Mock data - in real implementation, this would come from props or API
  const documents: Document[] = [
    {
      id: '1',
      title: 'Term Limits Research Paper',
      type: 'pdf',
      url: '#',
      size: '2.3 MB',
      uploadedAt: new Date('2024-01-15'),
      uploadedBy: { name: 'Dr. Sarah Chen', username: 'sarahchen' },
      tags: ['research', 'academic', 'politics']
    },
    {
      id: '2',
      title: 'Congressional Term Limits Chart',
      type: 'image',
      url: '#',
      size: '1.1 MB',
      uploadedAt: new Date('2024-01-14'),
      uploadedBy: { name: 'John Doe', username: 'johndoe' },
      tags: ['visualization', 'data']
    },
    {
      id: '3',
      title: 'Term Limits Explained Video',
      type: 'video',
      url: '#',
      size: '45.2 MB',
      uploadedAt: new Date('2024-01-13'),
      uploadedBy: { name: 'Jane Smith', username: 'janesmith' },
      tags: ['education', 'video']
    }
  ];

  const allTypes = ['all', ...Array.from(new Set(documents.map(doc => doc.type)))];
  const allTags = Array.from(new Set(documents.flatMap(doc => doc.tags)));

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || doc.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <File className="w-5 h-5" />;
      case 'image': return <Image className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pdf': return 'text-red-600 bg-red-50';
      case 'image': return 'text-green-600 bg-green-50';
      case 'video': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6 px-6 md:px-10">
      {/* Header and Controls */}
      <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[#0B0B0F]">Documents</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <div className="flex items-center border border-[#E6E8EC] rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#60646C] w-4 h-4" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-4 pt-4 border-t border-[#E6E8EC]">
            <div>
              <label className="block text-sm font-medium text-[#60646C] mb-2">
                Document Type
              </label>
              <div className="flex flex-wrap gap-2">
                {allTypes.map(type => (
                  <Badge
                    key={type}
                    variant={selectedType === type ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedType(type)}
                  >
                    {type === 'all' ? 'All Types' : type.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Documents Grid/List */}
      {filteredDocuments.length > 0 ? (
        <div className={
          viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            : "space-y-4"
        }>
          {filteredDocuments.map(doc => (
            <div
              key={doc.id}
              className={`rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-5 md:p-6 hover:shadow-md transition-shadow ${
                viewMode === 'list' ? 'flex items-center gap-4' : ''
              }`}
            >
              {viewMode === 'grid' ? (
                <>
                  {/* Grid View */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${getTypeColor(doc.type)}`}>
                      {getTypeIcon(doc.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[#0B0B0F] truncate">{doc.title}</h3>
                      <p className="text-sm text-[#60646C]">{doc.size}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-[#60646C]">
                      <span>Uploaded by {doc.uploadedBy.name}</span>
                      <span>•</span>
                      <span>{doc.uploadedAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-4">
                    {doc.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(doc.url, '_blank')}
                  >
                    View Document
                  </Button>
                </>
              ) : (
                <>
                  {/* List View */}
                  <div className={`p-2 rounded-lg ${getTypeColor(doc.type)}`}>
                    {getTypeIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[#0B0B0F] mb-1">{doc.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-[#60646C] mb-2">
                      <span>{doc.size}</span>
                      <span>•</span>
                      <span>Uploaded by {doc.uploadedBy.name}</span>
                      <span>•</span>
                      <span>{doc.uploadedAt.toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(doc.url, '_blank')}
                  >
                    View
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E6E8EC] bg-white shadow-sm p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#0B0B0F] mb-2">No documents found</h3>
          <p className="text-[#60646C] mb-4">
            {searchQuery || selectedType !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'No documents have been uploaded to this patch yet'
            }
          </p>
          <Button className="bg-[#FF6A00] hover:bg-[#E55A00] text-white">
            Upload Document
          </Button>
        </div>
      )}
    </div>
  );
}
