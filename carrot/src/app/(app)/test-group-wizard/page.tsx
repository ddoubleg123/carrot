'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle,
  Loader2
} from 'lucide-react'
import PatchHeader from '@/components/patch/PatchHeader'
import PatchTabs from '@/components/patch/PatchTabs'
import RightRail from '@/components/patch/RightRail'
import DiscoveryList from '@/app/(app)/patch/[handle]/components/DiscoveryList'

// Available tags and categories
const AVAILABLE_TAGS = [
  'Houston Oilers', 'NFL', 'Football', 'AFL', 'Warren Moon', 'Earl Campbell',
  'Championships', 'Team History', 'Player Profiles', 'Training Camp',
  'Game Analysis', 'Statistics', 'Memorabilia', 'Fan Stories',
  'Team History',
  'Player Profiles',
  'Championship History'
]

const AVAILABLE_CATEGORIES = [
  'Youth Sports',
  'Professional Sports', 
  'Health & Fitness',
  'Education',
  'Technology',
  'Science',
  'Arts & Culture',
  'Business',
  'Politics',
  'Environment'
]

export default function TestGroupWizardPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [createdPatch, setCreatedPatch] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  const [availableTags, setAvailableTags] = useState<string[]>(AVAILABLE_TAGS)
  const [availableCategories, setAvailableCategories] = useState<string[]>(AVAILABLE_CATEGORIES)
  const [aiError, setAiError] = useState<string | null>(null)

  // Load AI-generated tags and categories when moving to step 2
  useEffect(() => {
    if (currentStep === 2 && groupName.trim()) {
      const generateMetadata = async () => {
        setIsLoadingAI(true)
        setAiError(null)

        try {
          const response = await fetch('/api/ai/generate-group-metadata', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              groupName: groupName,
              description: groupDescription
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to generate AI metadata')
          }

          const result = await response.json()
          
          if (result.success && result.metadata) {
            setAvailableTags(result.metadata.tags || AVAILABLE_TAGS)
            setAvailableCategories(result.metadata.categories || AVAILABLE_CATEGORIES)
            console.log('[Test Wizard] AI generated metadata:', result.metadata)
          } else {
            throw new Error(result.error || 'Invalid AI response')
          }
        } catch (error) {
          console.error('Failed to generate AI metadata:', error)
          setAiError(error instanceof Error ? error.message : 'Failed to generate suggestions')
          
          // Keep fallback tags
          setAvailableTags(AVAILABLE_TAGS)
          setAvailableCategories(AVAILABLE_CATEGORIES)
        } finally {
          setIsLoadingAI(false)
        }
      }

      generateMetadata()
    }
  }, [currentStep, groupName, groupDescription])

  const handleContinue = async () => {
    if (currentStep === 2) {
      // Optimistic navigation
      setCurrentStep(3)

      // Simulate background save
      setIsSaving(true)
      setSaveStatus('saving')
      
      setTimeout(() => {
        setIsSaving(false)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }, 1500)
    } else if (currentStep === 3) {
      // Actually create the group and start discovery
      await createGroupAndStartDiscovery()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const createGroupAndStartDiscovery = async () => {
    setIsSaving(true)
    setSaveStatus('saving')
    
    try {
      console.log('Creating group with:', {
        name: groupName,
        description: groupDescription,
        tags: selectedTags,
        categories: selectedCategories
      })

      // Step 1: Create the patch/group
      const patchResponse = await fetch('/api/patches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          description: groupDescription,
          tags: selectedTags,
          categories: selectedCategories
        })
      })

      if (!patchResponse.ok) {
        throw new Error(`Failed to create patch: ${patchResponse.status}`)
      }

      const patch = await patchResponse.json()
      console.log('Created patch:', patch)
      console.log('Patch handle:', patch.patch?.handle)
      setCreatedPatch(patch.patch) // Set the actual patch object, not the wrapper

      // Step 2: Start content discovery
      const discoveryResponse = await fetch(`/api/patches/${patch.patch.handle}/start-discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_deepseek_search'
        })
      })

      if (!discoveryResponse.ok) {
        console.warn('Discovery start failed:', discoveryResponse.status)
        // Continue anyway - discovery might start later
      } else {
        const discoveryResult = await discoveryResponse.json()
        console.log('Started discovery:', discoveryResult)
      }

      setSaveStatus('saved')
      setIsSaving(false)
      
      // Show success message instead of redirecting
      console.log('Group created successfully!', patch)

    } catch (error) {
      console.error('Error creating group:', error)
      setSaveStatus('error')
      setIsSaving(false)
    }
  }

  const handleBack = () => {
    setCurrentStep(currentStep - 1)
  }

  const resetWizard = () => {
    setCurrentStep(1)
    setSelectedTags([])
    setSelectedCategories([])
    setGroupName('')
    setGroupDescription('')
    setSaveStatus('idle')
    setIsSaving(false)
    setCreatedPatch(null)
    setIsLoadingAI(false)
    setAvailableTags(AVAILABLE_TAGS)
    setAvailableCategories(AVAILABLE_CATEGORIES)
    setAiError(null)
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    )
  }

  // Mock patch data for the group page structure
  const mockPatch = {
    id: 'test-patch',
    handle: createdPatch?.handle || 'new-group',
    name: groupName || 'New Group',
    description: groupDescription || 'A new group',
    tags: selectedTags,
    colorScheme: 'orange',
    _count: {
      members: 1,
      posts: 0,
      events: 0,
      sources: createdPatch ? 0 : 34 // Start with 0 sources for new groups
    }
  }

  const mockFollowers = [
    {
      user: {
        id: '1',
        name: 'John Doe',
        image: 'https://ui-avatars.com/api/?name=John+Doe&background=FF6A00&color=fff&size=64&format=png'
      }
    }
  ]

  const mockBotSubscriptions: any[] = []

  return (
    <div className="min-h-screen bg-white">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Test Group Page Structure
          </h1>
          <p className="text-gray-600">
            Testing the proper group page layout with production-quality discovery cards
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={resetWizard}
          disabled={isSaving}
        >
          Reset Wizard
        </Button>
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
              
              {/* AI Loading State */}
              {isLoadingAI && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Customizing your tags for you...
                </div>
              )}

              {/* AI Error State */}
              {aiError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  Tag generation failed: {aiError}. Using fallback options.
                </div>
              )}
              
              {/* Tags Section */}
              <div>
                <h4 className="text-base font-medium text-gray-900 mb-3">
                  Tags — select all that apply
                </h4>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
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
                  {availableCategories.map((category) => (
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
              {saveStatus === 'saved' ? (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <CheckCircle className="w-16 h-16 text-green-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-green-700">Group Created Successfully!</h3>
                  <p className="text-gray-600">Your group "{groupName}" has been created and content discovery has been started.</p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-2">What's Next?</h4>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• AI is discovering relevant content for your group</li>
                      <li>• Check the group page to see discovered content</li>
                      <li>• Invite members to join your group</li>
                    </ul>
                  </div>
                  <Button 
                    onClick={resetWizard}
                    variant="outline"
                    className="mt-4"
                  >
                    Create Another Group
                  </Button>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}

          {/* Footer Actions */}
          {!(currentStep === 3 && saveStatus === 'saved') && (
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
          )}
        </CardContent>
      </Card>

      {/* Group Page Structure - Only show after group is created */}
      {createdPatch ? (
        <div className="space-y-8">
          {/* Patch Header */}
          <PatchHeader patch={mockPatch as any} />

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-8">
              {/* Main Content Area */}
              <div className="max-w-[880px]">
                <PatchTabs activeTab={activeTab} patch={mockPatch as any}>
                  {activeTab === 'overview' && (
                    <div className="space-y-8 px-6 md:px-10">
                      {/* Discovering Content */}
                      <div>
                        <DiscoveryList patchHandle={createdPatch.handle} />
                      </div>
                    </div>
                  )}
                  {activeTab === 'documents' && (
                    <div className="p-6 text-center text-gray-500">
                      Documents view would go here
                    </div>
                  )}
                  {activeTab === 'timeline' && (
                    <div className="p-6 text-center text-gray-500">
                      Timeline view would go here
                    </div>
                  )}
                  {activeTab === 'sources' && (
                    <div className="p-6 text-center text-gray-500">
                      Sources view would go here
                    </div>
                  )}
                  {activeTab === 'discussions' && (
                    <div className="p-6 text-center text-gray-500">
                      Discussions view would go here
                    </div>
                  )}
                </PatchTabs>
              </div>

              {/* Right Rail */}
              <div className="w-[320px] shrink-0">
                <RightRail
                  patch={mockPatch as any}
                  followers={mockFollowers as any}
                  botSubscriptions={mockBotSubscriptions as any}
                  followerCount={mockFollowers.length}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Group Preview
          </h3>
          <p className="text-gray-600">
            Complete the wizard above to see your group page and content discovery in action.
          </p>
        </div>
      )}
    </div>
  )
}