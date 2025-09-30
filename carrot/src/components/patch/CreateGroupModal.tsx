'use client';

import { useState } from 'react';
import { X, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GroupFormData) => Promise<void>;
}

interface GroupFormData {
  name: string;
  description: string;
  tags: string[];
  categories: string[];
}

interface AIMetadata {
  tags: string[];
  categories: string[];
}

export default function CreateGroupModal({ isOpen, onClose, onSubmit }: CreateGroupModalProps) {
  const [step, setStep] = useState<'name' | 'metadata' | 'final'>('name');
  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    tags: [],
    categories: []
  });
  const [aiMetadata, setAiMetadata] = useState<AIMetadata>({ tags: [], categories: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);

  if (!isOpen) return null;

  const generateAIMetadata = async () => {
    if (!formData.name.trim()) return;

    setIsGeneratingMetadata(true);
    try {
      const response = await fetch('/api/ai/generate-group-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupName: formData.name,
          description: formData.description
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate metadata');
      }

      const result = await response.json();
      setAiMetadata(result.metadata);
      setStep('metadata');
    } catch (error) {
      console.error('Failed to generate AI metadata:', error);
      // Fallback to basic metadata
      setAiMetadata({
        tags: [formData.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')],
        categories: ['General']
      });
      setStep('metadata');
    } finally {
      setIsGeneratingMetadata(false);
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    await generateAIMetadata();
  };

  const handleMetadataSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Trigger background content discovery
    try {
      const response = await fetch('/api/ai/discover-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patchId: 'temp-' + Date.now(), // Temporary ID, will be updated after creation
          patchName: formData.name,
          description: formData.description,
          tags: formData.tags,
          categories: formData.categories
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Background discovery started:', result);
        // Store the discovery result for later use
        (window as any).pendingDiscovery = result;
      }
    } catch (error) {
      console.error('Failed to start background discovery:', error);
      // Continue anyway - discovery is not critical for group creation
    }
    
    setStep('final');
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({
        name: '',
        description: '',
        tags: [],
        categories: []
      });
      setAiMetadata({ tags: [], categories: [] });
      setStep('name');
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const toggleCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };


  const renderStepContent = () => {
    switch (step) {
      case 'name':
        return (
          <form onSubmit={handleNameSubmit} className="p-6 space-y-6">
            {/* Group Name */}
            <div>
              <label htmlFor="group-name" className="block text-sm font-medium text-gray-700 mb-2">
                Group Name *
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="group-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter group name"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this group is about..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isGeneratingMetadata}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                disabled={!formData.name.trim() || isGeneratingMetadata}
              >
                {isGeneratingMetadata ? 'Generating...' : 'Continue'}
              </Button>
            </div>
          </form>
        );

      case 'metadata':
        return (
          <form onSubmit={handleMetadataSubmit} className="p-6 space-y-6">
            {/* AI Generated Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Tags (AI Generated)
              </label>
              <div className="flex flex-wrap gap-2">
                {aiMetadata.tags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      formData.tags.includes(tag)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Generated Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Categories (AI Generated)
              </label>
              <div className="space-y-2">
                {aiMetadata.categories.map(category => (
                  <label key={category} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.categories.includes(category)}
                      onChange={() => toggleCategory(category)}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <span className="font-medium text-gray-900">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('name')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
              >
                Continue
              </Button>
            </div>
          </form>
        );

      case 'final':
        return (
          <form onSubmit={handleFinalSubmit} className="p-6 space-y-6">
            {/* Review */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-gray-900">Review Your Group</h3>
              <div>
                <span className="text-sm text-gray-600">Name:</span>
                <span className="ml-2 font-medium">{formData.name}</span>
              </div>
              {formData.description && (
                <div>
                  <span className="text-sm text-gray-600">Description:</span>
                  <span className="ml-2">{formData.description}</span>
                </div>
              )}
              {formData.tags.length > 0 && (
                <div>
                  <span className="text-sm text-gray-600">Tags:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {formData.categories.length > 0 && (
                <div>
                  <span className="text-sm text-gray-600">Categories:</span>
                  <span className="ml-2">{formData.categories.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('metadata')}
                className="flex-1"
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Group'}
              </Button>
            </div>
          </form>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'name': return 'Create New Group';
      case 'metadata': return 'Select Tags & Categories';
      case 'final': return 'Review & Create';
      default: return 'Create New Group';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'name': return 'Start a new knowledge group';
      case 'metadata': return 'AI has generated relevant options for you';
      case 'final': return 'Review your selections and create the group';
      default: return 'Start a new knowledge group';
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{getStepTitle()}</h2>
            <p className="text-sm text-gray-600 mt-1">{getStepDescription()}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Step Content */}
        {renderStepContent()}
      </div>
    </div>
  );
}
