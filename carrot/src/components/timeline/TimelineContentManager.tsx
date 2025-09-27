'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Upload, 
  Video, 
  Image, 
  FileText, 
  Link, 
  X, 
  Edit3, 
  Trash2,
  Play,
  Eye,
  Download
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  content: {
    type: 'text' | 'image' | 'video' | 'pdf' | 'link';
    url?: string;
    title?: string;
    description?: string;
    thumbnail?: string;
  }[];
}

interface TimelineContentManagerProps {
  event: TimelineEvent;
  onUpdate: (event: TimelineEvent) => void;
  onClose: () => void;
}

export default function TimelineContentManager({ event, onUpdate, onClose }: TimelineContentManagerProps) {
  const [isAddingContent, setIsAddingContent] = useState(false);
  const [newContentType, setNewContentType] = useState<'text' | 'image' | 'video' | 'pdf' | 'link'>('text');
  const [newContent, setNewContent] = useState({
    title: '',
    description: '',
    url: '',
    file: null as File | null
  });

  const handleAddContent = async () => {
    if (!newContent.title.trim()) return;

    const contentItem = {
      type: newContentType,
      title: newContent.title,
      description: newContent.description,
      url: newContent.url,
      thumbnail: newContentType === 'video' ? '/video-thumbnail-placeholder.jpg' : undefined
    };

    const updatedEvent = {
      ...event,
      content: [...event.content, contentItem]
    };

    onUpdate(updatedEvent);
    
    // Reset form
    setNewContent({ title: '', description: '', url: '', file: null });
    setIsAddingContent(false);
  };

  const handleRemoveContent = (index: number) => {
    const updatedEvent = {
      ...event,
      content: event.content.filter((_, i) => i !== index)
    };
    onUpdate(updatedEvent);
  };

  const handleFileUpload = async (file: File) => {
    // Simulate file upload - in real implementation, upload to your storage
    console.log('Uploading file:', file.name);
    // Return the uploaded URL
    return `https://example.com/uploads/${file.name}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{event.title}</h2>
            <p className="text-gray-600 mt-1">{event.date}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Add Content Button */}
          <div className="mb-6">
            <button
              onClick={() => setIsAddingContent(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Content
            </button>
          </div>

          {/* Add Content Form */}
          {isAddingContent && (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">Add New Content</h3>
              
              {/* Content Type Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
                <div className="flex gap-2">
                  {[
                    { type: 'text', icon: FileText, label: 'Text' },
                    { type: 'image', icon: Image, label: 'Image' },
                    { type: 'video', icon: Video, label: 'Video' },
                    { type: 'pdf', icon: FileText, label: 'PDF' },
                    { type: 'link', icon: Link, label: 'Link' }
                  ].map(({ type, icon: Icon, label }) => (
                    <button
                      key={type}
                      onClick={() => setNewContentType(type as any)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        newContentType === type
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={newContent.title}
                    onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Enter content title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newContent.description}
                    onChange={(e) => setNewContent({ ...newContent, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    rows={3}
                    placeholder="Enter content description"
                  />
                </div>

                {(newContentType === 'image' || newContentType === 'video' || newContentType === 'pdf') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {newContentType === 'image' ? 'Image' : newContentType === 'video' ? 'Video' : 'PDF'} File
                    </label>
                    <input
                      type="file"
                      accept={
                        newContentType === 'image' ? 'image/*' :
                        newContentType === 'video' ? 'video/*' :
                        'application/pdf'
                      }
                      onChange={(e) => setNewContent({ ...newContent, file: e.target.files?.[0] || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                )}

                {(newContentType === 'link' || newContentType === 'video') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                    <input
                      type="url"
                      value={newContent.url}
                      onChange={(e) => setNewContent({ ...newContent, url: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Enter URL"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddContent}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Add Content
                  </button>
                  <button
                    onClick={() => setIsAddingContent(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Content List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Content ({event.content.length})</h3>
            
            {event.content.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No content added yet</p>
                <p className="text-sm">Click "Add Content" to get started</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {event.content.map((content, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Content Type Icon */}
                        <div className="flex-shrink-0">
                          {content.type === 'image' && <Image className="w-5 h-5 text-blue-500" />}
                          {content.type === 'video' && <Video className="w-5 h-5 text-green-500" />}
                          {content.type === 'pdf' && <FileText className="w-5 h-5 text-red-500" />}
                          {content.type === 'link' && <Link className="w-5 h-5 text-purple-500" />}
                          {content.type === 'text' && <FileText className="w-5 h-5 text-gray-500" />}
                        </div>

                        {/* Content Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{content.title}</h4>
                          {content.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{content.description}</p>
                          )}
                          {content.url && (
                            <p className="text-xs text-blue-600 mt-1 truncate">{content.url}</p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => window.open(content.url, '_blank')}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleRemoveContent(index)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
