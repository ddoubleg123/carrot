'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import telemetry from '@/lib/telemetry';

// Design tokens from Carrot standards
const TOKENS = {
  colors: {
    actionOrange: '#FF6A00',
    civicBlue: '#0A5AFF',
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
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // ease-in-out
  typography: {
    h2: '28px',
    body: '16px',
    caption: '12px',
  }
};

interface WizardStep {
  id: string;
  title: string;
  label: string;
  component: React.ComponentType<WizardStepProps>;
}

interface WizardStepProps {
  data: GroupFormData;
  onUpdate: (data: Partial<GroupFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  isLoading?: boolean;
  getMotionTransition?: (duration?: string) => string;
}

interface GroupFormData {
  name: string;
  description: string;
  tags: string[];
  categories: string[];
}

interface CreateGroupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (groupId: string) => void;
}

// Step 1: Details Component
const Step1Details: React.FC<WizardStepProps> = ({ data, onUpdate, onNext, isLoading, getMotionTransition }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = useCallback(() => {
    const newErrors: Record<string, string> = {};
    
    if (!data.name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (data.name.length < 3) {
      newErrors.name = 'Group name must be at least 3 characters';
    } else if (data.name.length > 60) {
      newErrors.name = 'Group name must be less than 60 characters';
    }

    if (data.description.length > 240) {
      newErrors.description = 'Description must be less than 240 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [data]);

  const handleNext = () => {
    if (validateStep()) {
      onNext();
    }
  };

  const showCharCount = data.description.length >= 200;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.spacing.lg }}>
      <div>
        <label 
          htmlFor="group-name"
          style={{ 
            display: 'block', 
            fontSize: TOKENS.typography.body, 
            fontWeight: 500, 
            color: TOKENS.colors.ink,
            marginBottom: TOKENS.spacing.sm 
          }}
        >
          Group Name *
        </label>
        <input
          id="group-name"
          type="text"
          value={data.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Enter group name"
          maxLength={60}
          style={{
            width: '100%',
            padding: TOKENS.spacing.md,
            border: `1px solid ${errors.name ? TOKENS.colors.danger : TOKENS.colors.line}`,
            borderRadius: TOKENS.radii.md,
            fontSize: TOKENS.typography.body,
            outline: 'none',
            transition: `border-color ${TOKENS.motion.normal} ease-in-out`,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = TOKENS.colors.civicBlue;
            e.target.style.boxShadow = `0 0 0 2px ${TOKENS.colors.civicBlue}20`;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = errors.name ? TOKENS.colors.danger : TOKENS.colors.line;
            e.target.style.boxShadow = 'none';
          }}
        />
        {errors.name && (
          <div style={{ 
            color: TOKENS.colors.danger, 
            fontSize: TOKENS.typography.caption, 
            marginTop: TOKENS.spacing.xs 
          }}>
            {errors.name}
          </div>
        )}
        <div style={{ 
          color: TOKENS.colors.slate, 
          fontSize: TOKENS.typography.caption, 
          marginTop: TOKENS.spacing.xs 
        }}>
          Keep it short and scannable.
        </div>
      </div>

      <div>
        <label 
          htmlFor="group-description"
          style={{ 
            display: 'block', 
            fontSize: TOKENS.typography.body, 
            fontWeight: 500, 
            color: TOKENS.colors.ink,
            marginBottom: TOKENS.spacing.sm 
          }}
        >
          Description
        </label>
        <textarea
          id="group-description"
          value={data.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Describe what this group is about..."
          maxLength={240}
          rows={4}
          style={{
            width: '100%',
            padding: TOKENS.spacing.md,
            border: `1px solid ${errors.description ? TOKENS.colors.danger : TOKENS.colors.line}`,
            borderRadius: TOKENS.radii.md,
            fontSize: TOKENS.typography.body,
            outline: 'none',
            resize: 'vertical',
            minHeight: '100px',
            transition: `border-color ${TOKENS.motion.normal} ease-in-out`,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = TOKENS.colors.civicBlue;
            e.target.style.boxShadow = `0 0 0 2px ${TOKENS.colors.civicBlue}20`;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = errors.description ? TOKENS.colors.danger : TOKENS.colors.line;
            e.target.style.boxShadow = 'none';
          }}
        />
        {errors.description && (
          <div style={{ 
            color: TOKENS.colors.danger, 
            fontSize: TOKENS.typography.caption, 
            marginTop: TOKENS.spacing.xs 
          }}>
            {errors.description}
          </div>
        )}
        <div style={{ 
          color: TOKENS.colors.slate, 
          fontSize: TOKENS.typography.caption, 
          marginTop: TOKENS.spacing.xs 
        }}>
          Ex: Tips and creative drills for youth cheer coaches.
        </div>
        {showCharCount && (
          <div style={{ 
            color: TOKENS.colors.slate, 
            fontSize: TOKENS.typography.caption, 
            marginTop: TOKENS.spacing.xs,
            textAlign: 'right'
          }}>
            {data.description.length}/240
          </div>
        )}
      </div>
    </div>
  );
};

// Step 2: Topics Component
const Step2Topics: React.FC<WizardStepProps> = ({ data, onUpdate, onNext, onBack, isLoading, getMotionTransition }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  // Load AI-generated tags and categories when component mounts
  useEffect(() => {
    const generateMetadata = async () => {
      if (!data.name.trim()) {
        // Fallback to basic tags if no name
        setAvailableTags(['general', 'community', 'discussion']);
        setAvailableCategories(['General']);
        return;
      }

      setIsLoadingAI(true);
      setAiError(null);

      try {
        const response = await fetch('/api/ai/generate-group-metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupName: data.name,
            description: data.description
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate AI metadata');
        }

        const result = await response.json();
        
        if (result.success && result.metadata) {
          setAvailableTags(result.metadata.tags || []);
          setAvailableCategories(result.metadata.categories || []);
          console.log('[CreateGroupWizard] AI generated metadata:', result.metadata);
        } else {
          throw new Error(result.error || 'Invalid AI response');
        }
      } catch (error) {
        console.error('Failed to generate AI metadata:', error);
        setAiError(error instanceof Error ? error.message : 'Failed to generate suggestions');
        
        // Fallback to basic tags based on group name
        const fallbackTags = [
          data.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-'),
          'community',
          'discussion',
          'knowledge'
        ];
        setAvailableTags(fallbackTags);
        setAvailableCategories(['General']);
      } finally {
        setIsLoadingAI(false);
      }
    };

    generateMetadata();
  }, []); // Only run once when component mounts

  const filteredTags = availableTags.filter(tag => 
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTag = (tag: string) => {
    const newTags = data.tags.includes(tag)
      ? data.tags.filter(t => t !== tag)
      : [...data.tags, tag];
    onUpdate({ tags: newTags });
  };

  const toggleCategory = (category: string) => {
    const newCategories = data.categories.includes(category)
      ? data.categories.filter(c => c !== category)
      : [...data.categories, category];
    onUpdate({ categories: newCategories });
  };

  const handleNext = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    // Optimistic navigation - move to next step immediately
    onNext();
    
    // Background save (simulated)
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      setIsSaving(false);
    } catch (error) {
      setSaveError('We couldn\'t save your topics. Retry.');
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.spacing.lg }}>
      {/* AI Loading State */}
      {isLoadingAI && (
        <div style={{
          padding: TOKENS.spacing.md,
          background: '#F0F9FF',
          border: `1px solid ${TOKENS.colors.civicBlue}`,
          borderRadius: TOKENS.radii.md,
          color: TOKENS.colors.civicBlue,
          fontSize: TOKENS.typography.body,
          display: 'flex',
          alignItems: 'center',
          gap: TOKENS.spacing.sm
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: `2px solid ${TOKENS.colors.civicBlue}`,
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Generating personalized suggestions with AI...
        </div>
      )}

      {/* AI Error State */}
      {aiError && (
        <div style={{
          padding: TOKENS.spacing.md,
          background: '#FEF2F2',
          border: `1px solid ${TOKENS.colors.danger}`,
          borderRadius: TOKENS.radii.md,
          color: TOKENS.colors.danger,
          fontSize: TOKENS.typography.body
        }}>
          AI suggestions failed: {aiError}. Using fallback options.
        </div>
      )}

      {saveError && (
        <div style={{
          padding: TOKENS.spacing.md,
          background: '#FEF2F2',
          border: `1px solid ${TOKENS.colors.danger}`,
          borderRadius: TOKENS.radii.md,
          color: TOKENS.colors.danger,
          fontSize: TOKENS.typography.body
        }}>
          {saveError}
          <button 
            onClick={() => setSaveError(null)}
            style={{
              marginLeft: TOKENS.spacing.md,
              color: TOKENS.colors.danger,
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div>
        <label 
          htmlFor="tag-search"
          style={{ 
            display: 'block', 
            fontSize: TOKENS.typography.body, 
            fontWeight: 500, 
            color: TOKENS.colors.ink,
            marginBottom: TOKENS.spacing.sm 
          }}
        >
          Tags — select all that apply
          {!isLoadingAI && !aiError && availableTags.length > 0 && (
            <span style={{ 
              fontSize: TOKENS.typography.caption, 
              color: TOKENS.colors.slate, 
              fontWeight: 400,
              marginLeft: TOKENS.spacing.sm 
            }}>
              (AI-generated suggestions)
            </span>
          )}
        </label>
        <input
          id="tag-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tags…"
          style={{
            width: '100%',
            padding: TOKENS.spacing.md,
            border: `1px solid ${TOKENS.colors.line}`,
            borderRadius: TOKENS.radii.md,
            fontSize: TOKENS.typography.body,
            outline: 'none',
            marginBottom: TOKENS.spacing.md,
            transition: `border-color ${TOKENS.motion.normal} ease-in-out`,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = TOKENS.colors.civicBlue;
            e.target.style.boxShadow = `0 0 0 2px ${TOKENS.colors.civicBlue}20`;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = TOKENS.colors.line;
            e.target.style.boxShadow = 'none';
          }}
        />
        
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: TOKENS.spacing.sm,
          minHeight: '44px',
          alignItems: 'flex-start'
        }}>
          {filteredTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              style={{
                padding: `${TOKENS.spacing.sm} ${TOKENS.spacing.md}`,
                border: `1px solid ${data.tags.includes(tag) ? TOKENS.colors.civicBlue : TOKENS.colors.line}`,
                borderRadius: TOKENS.radii.lg,
                background: data.tags.includes(tag) ? TOKENS.colors.civicBlue : TOKENS.colors.surface,
                color: data.tags.includes(tag) ? TOKENS.colors.surface : TOKENS.colors.ink,
                fontSize: TOKENS.typography.body,
                cursor: 'pointer',
                transition: getMotionTransition?.(TOKENS.motion.fast) || `all ${TOKENS.motion.fast} ${TOKENS.easing}`,
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => {
                if (!data.tags.includes(tag)) {
                  e.currentTarget.style.borderColor = TOKENS.colors.civicBlue;
                }
              }}
              onMouseLeave={(e) => {
                if (!data.tags.includes(tag)) {
                  e.currentTarget.style.borderColor = TOKENS.colors.line;
                }
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ 
          display: 'block', 
          fontSize: TOKENS.typography.body, 
          fontWeight: 500, 
          color: TOKENS.colors.ink,
          marginBottom: TOKENS.spacing.md 
        }}>
          Categories — select all that apply
          {!isLoadingAI && !aiError && availableCategories.length > 0 && (
            <span style={{ 
              fontSize: TOKENS.typography.caption, 
              color: TOKENS.colors.slate, 
              fontWeight: 400,
              marginLeft: TOKENS.spacing.sm 
            }}>
              (AI-generated suggestions)
            </span>
          )}
        </label>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.spacing.sm }}>
          {availableCategories.map(category => (
            <label
              key={category}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: TOKENS.spacing.md,
                padding: TOKENS.spacing.md,
                border: `1px solid ${TOKENS.colors.line}`,
                borderRadius: TOKENS.radii.md,
                cursor: 'pointer',
                transition: `border-color ${TOKENS.motion.normal} ease-in-out`,
                minHeight: '44px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = TOKENS.colors.civicBlue;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = TOKENS.colors.line;
              }}
            >
              <input
                type="checkbox"
                checked={data.categories.includes(category)}
                onChange={() => toggleCategory(category)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: TOKENS.colors.civicBlue
                }}
              />
              <span style={{ fontSize: TOKENS.typography.body, color: TOKENS.colors.ink }}>
                {category}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

// Step 3: Review Component
const Step3Review: React.FC<WizardStepProps> = ({ data, onUpdate, onNext, onBack, isLoading, getMotionTransition }) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate a mock group ID
      const groupId = `group-${Date.now()}`;
      
      // Call success callback
      onNext(); // This will be handled by the parent to close modal and navigate
    } catch (error) {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.spacing.lg }}>
      {/* Name Card */}
      <div style={{
        padding: TOKENS.spacing.lg,
        border: `1px solid ${TOKENS.colors.line}`,
        borderRadius: TOKENS.radii.lg,
        background: TOKENS.colors.surface
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: TOKENS.spacing.sm }}>
          <h3 style={{ fontSize: TOKENS.typography.body, fontWeight: 600, color: TOKENS.colors.ink, margin: 0 }}>
            Group Name
          </h3>
          <button
            onClick={() => {/* Navigate back to step 1 */}}
            style={{
              color: TOKENS.colors.civicBlue,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: TOKENS.typography.caption,
              textDecoration: 'underline'
            }}
          >
            Edit
          </button>
        </div>
        <p style={{ fontSize: TOKENS.typography.body, color: TOKENS.colors.ink, margin: 0 }}>
          {data.name}
        </p>
      </div>

      {/* Description Card */}
      <div style={{
        padding: TOKENS.spacing.lg,
        border: `1px solid ${TOKENS.colors.line}`,
        borderRadius: TOKENS.radii.lg,
        background: TOKENS.colors.surface
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: TOKENS.spacing.sm }}>
          <h3 style={{ fontSize: TOKENS.typography.body, fontWeight: 600, color: TOKENS.colors.ink, margin: 0 }}>
            Description
          </h3>
          <button
            onClick={() => {/* Navigate back to step 1 */}}
            style={{
              color: TOKENS.colors.civicBlue,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: TOKENS.typography.caption,
              textDecoration: 'underline'
            }}
          >
            Edit
          </button>
        </div>
        <p style={{ fontSize: TOKENS.typography.body, color: TOKENS.colors.ink, margin: 0 }}>
          {data.description || 'No description provided'}
        </p>
      </div>

      {/* Tags Card */}
      <div style={{
        padding: TOKENS.spacing.lg,
        border: `1px solid ${TOKENS.colors.line}`,
        borderRadius: TOKENS.radii.lg,
        background: TOKENS.colors.surface
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: TOKENS.spacing.sm }}>
          <h3 style={{ fontSize: TOKENS.typography.body, fontWeight: 600, color: TOKENS.colors.ink, margin: 0 }}>
            Tags
          </h3>
          <button
            onClick={() => {/* Navigate back to step 2 */}}
            style={{
              color: TOKENS.colors.civicBlue,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: TOKENS.typography.caption,
              textDecoration: 'underline'
            }}
          >
            Edit
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: TOKENS.spacing.sm }}>
          {data.tags.length > 0 ? (
            data.tags.map(tag => (
              <span
                key={tag}
                style={{
                  padding: `${TOKENS.spacing.xs} ${TOKENS.spacing.sm}`,
                  background: TOKENS.colors.civicBlue,
                  color: TOKENS.colors.surface,
                  borderRadius: TOKENS.radii.sm,
                  fontSize: TOKENS.typography.caption
                }}
              >
                {tag}
              </span>
            ))
          ) : (
            <span style={{ color: TOKENS.colors.slate, fontSize: TOKENS.typography.body }}>
              No tags selected
            </span>
          )}
        </div>
      </div>

      {/* Categories Card */}
      <div style={{
        padding: TOKENS.spacing.lg,
        border: `1px solid ${TOKENS.colors.line}`,
        borderRadius: TOKENS.radii.lg,
        background: TOKENS.colors.surface
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: TOKENS.spacing.sm }}>
          <h3 style={{ fontSize: TOKENS.typography.body, fontWeight: 600, color: TOKENS.colors.ink, margin: 0 }}>
            Categories
          </h3>
          <button
            onClick={() => {/* Navigate back to step 2 */}}
            style={{
              color: TOKENS.colors.civicBlue,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: TOKENS.typography.caption,
              textDecoration: 'underline'
            }}
          >
            Edit
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: TOKENS.spacing.sm }}>
          {data.categories.length > 0 ? (
            data.categories.map(category => (
              <span
                key={category}
                style={{
                  padding: `${TOKENS.spacing.xs} ${TOKENS.spacing.sm}`,
                  background: TOKENS.colors.slate,
                  color: TOKENS.colors.surface,
                  borderRadius: TOKENS.radii.sm,
                  fontSize: TOKENS.typography.caption
                }}
              >
                {category}
              </span>
            ))
          ) : (
            <span style={{ color: TOKENS.colors.slate, fontSize: TOKENS.typography.body }}>
              No categories selected
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Wizard Component
const CreateGroupWizard: React.FC<CreateGroupWizardProps> = ({ isOpen, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    tags: [],
    categories: []
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Track wizard open and reset form when closed
  useEffect(() => {
    if (isOpen) {
      telemetry.trackGroupCreateOpen();
    } else {
      // Reset form data when modal is closed (with a small delay to avoid race conditions)
      const resetTimer = setTimeout(() => {
        setFormData({
          name: '',
          description: '',
          tags: [],
          categories: []
        });
        setCurrentStep(0);
      }, 100);
      
      return () => clearTimeout(resetTimer);
    }
  }, [isOpen]);

  // Helper function for motion transitions
  const getMotionTransition = (duration: string = TOKENS.motion.normal) => {
    return prefersReducedMotion ? 'none' : `all ${duration} ${TOKENS.easing}`;
  };

  const steps: WizardStep[] = [
    {
      id: 'details',
      title: 'Create New Group',
      label: 'Details',
      component: Step1Details
    },
    {
      id: 'topics',
      title: 'Choose Topics',
      label: 'Topics',
      component: Step2Topics
    },
    {
      id: 'review',
      title: 'Review & Create',
      label: 'Review',
      component: Step3Review
    }
  ];

  const currentStepData = steps[currentStep];
  const CurrentStepComponent = currentStepData.component;

  const handleNext = async () => {
    const startTime = performance.now();
    
    if (currentStep < steps.length - 1) {
      // Track step completion
      telemetry.trackStepComplete(currentStep, steps[currentStep].label, {
        name_length: formData.name.length,
        description_length: formData.description.length,
        tags_count: formData.tags.length,
        categories_count: formData.categories.length
      });
      
      setCurrentStep(currentStep + 1);
      
      // Track step transition latency
      const latency = performance.now() - startTime;
      telemetry.trackStepContinue(currentStep, steps[currentStep].label, latency);
    } else {
      // Final step - create group
      try {
        const payload = {
          name: formData.name,
          description: formData.description,
          tags: formData.tags,
          categories: formData.categories
        };
        
        console.log('[CreateGroupWizard] Sending payload:', payload);
        console.log('[CreateGroupWizard] Form data before send:', formData);
        
        const response = await fetch('/api/patches', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create group');
        }

        const groupData = await response.json();
        const totalTime = performance.now() - startTime;
        telemetry.trackGroupCreateSuccess(groupData.id, totalTime);
        onSuccess(groupData.id);
        onClose();
      } catch (error) {
        console.error('Failed to create group:', error);
        telemetry.trackGroupCreateError(error instanceof Error ? error.message : 'Unknown error');
        // You might want to show an error message to the user here
        alert(`Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleUpdate = (updates: Partial<GroupFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleClose = () => {
    if (formData.name || formData.description || formData.tags.length > 0 || formData.categories.length > 0) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, formData]);

  if (!isOpen) return null;

  return (
    <>
      {/* CSS Animation for spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        aria-describedby="wizard-description"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: TOKENS.spacing.lg
        }}
      >
      <div style={{
        background: TOKENS.colors.surface,
        borderRadius: TOKENS.radii.xl,
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: TOKENS.spacing.xl,
          borderBottom: `1px solid ${TOKENS.colors.line}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 
              id="wizard-title"
              style={{
                fontSize: TOKENS.typography.h2,
                fontWeight: 600,
                color: TOKENS.colors.ink,
                margin: 0,
                marginBottom: TOKENS.spacing.xs
              }}
            >
              {currentStepData.title}
            </h2>
            <p 
              id="wizard-description"
              style={{
                fontSize: TOKENS.typography.body,
                color: TOKENS.colors.slate,
                margin: 0
              }}
            >
              {currentStep === 0 && 'Give your group a name and description.'}
              {currentStep === 1 && 'Select all that apply. You can change these later.'}
              {currentStep === 2 && 'Review your group details before creating.'}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: TOKENS.spacing.sm,
              borderRadius: TOKENS.radii.sm,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = TOKENS.colors.line;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <X size={20} color={TOKENS.colors.slate} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div style={{
          padding: `${TOKENS.spacing.lg} ${TOKENS.spacing.xl}`,
          borderBottom: `1px solid ${TOKENS.colors.line}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: TOKENS.spacing.lg }}>
            {steps.map((step, index) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: TOKENS.spacing.sm }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: index <= currentStep ? TOKENS.colors.actionOrange : `${TOKENS.colors.slate}60`,
                    color: TOKENS.colors.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: TOKENS.typography.caption,
                    fontWeight: 600,
                    cursor: index < currentStep ? 'pointer' : 'default',
                    transition: getMotionTransition()
                  }}
                  onClick={() => index < currentStep && setCurrentStep(index)}
                >
                  {index + 1}
                </div>
                <span style={{
                  fontSize: TOKENS.typography.body,
                  color: index <= currentStep ? TOKENS.colors.ink : `${TOKENS.colors.slate}60`,
                  fontWeight: index === currentStep ? 600 : 400
                }}>
                  {step.label}
                </span>
                {index < steps.length - 1 && (
                  <div style={{
                    width: '24px',
                    height: '1px',
                    background: index < currentStep ? TOKENS.colors.actionOrange : TOKENS.colors.line,
                    marginLeft: TOKENS.spacing.sm
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: TOKENS.spacing.xl,
          flex: 1,
          overflow: 'auto'
        }}>
          <CurrentStepComponent
            data={formData}
            onUpdate={handleUpdate}
            onNext={handleNext}
            onBack={handleBack}
            getMotionTransition={getMotionTransition}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: TOKENS.spacing.xl,
          borderTop: `1px solid ${TOKENS.colors.line}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            style={{
              padding: `${TOKENS.spacing.md} ${TOKENS.spacing.lg}`,
              border: `1px solid ${TOKENS.colors.line}`,
              borderRadius: TOKENS.radii.md,
              background: TOKENS.colors.surface,
              color: currentStep === 0 ? TOKENS.colors.slate : TOKENS.colors.ink,
              fontSize: TOKENS.typography.body,
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: TOKENS.spacing.sm,
              transition: getMotionTransition(),
              opacity: currentStep === 0 ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (currentStep > 0) {
                e.currentTarget.style.borderColor = TOKENS.colors.civicBlue;
              }
            }}
            onMouseLeave={(e) => {
              if (currentStep > 0) {
                e.currentTarget.style.borderColor = TOKENS.colors.line;
              }
            }}
          >
            <ChevronLeft size={16} />
            Back
          </button>

          <button
            onClick={handleNext}
            style={{
              padding: `${TOKENS.spacing.md} ${TOKENS.spacing.lg}`,
              border: 'none',
              borderRadius: TOKENS.radii.md,
              background: TOKENS.colors.actionOrange,
              color: TOKENS.colors.surface,
              fontSize: TOKENS.typography.body,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: TOKENS.spacing.sm,
              transition: getMotionTransition(),
              minHeight: '44px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#E55A00';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = TOKENS.colors.actionOrange;
            }}
          >
            {currentStep === steps.length - 1 ? 'Create Group' : 'Continue'}
            {currentStep < steps.length - 1 && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </>
  );
};

export default CreateGroupWizard;
