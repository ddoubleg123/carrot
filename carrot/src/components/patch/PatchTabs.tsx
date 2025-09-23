'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { BookOpen, Calendar, MessageSquare, FileText } from 'lucide-react'

interface Patch {
  id: string
  handle: string
  name: string
}

interface PatchTabsProps {
  activeTab: string
  patch: Patch
  children: React.ReactNode
}

export default function PatchTabs({ activeTab, patch, children }: PatchTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    router.push(`/patch/${patch.handle}?${params.toString()}`)
  }

  const tabs = [
    {
      value: 'overview',
      label: 'Overview',
      icon: BookOpen,
    },
    {
      value: 'timeline',
      label: 'Timeline',
      icon: Calendar,
    },
    {
      value: 'posts',
      label: 'Posts',
      icon: MessageSquare,
    },
    {
      value: 'references',
      label: 'References',
      icon: FileText,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-4 bg-transparent p-0 h-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 px-6 py-4 text-base font-medium data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:bg-transparent data-[state=active]:text-orange-600 rounded-none border-b-2 border-transparent hover:text-gray-700 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {children}
      </div>
    </div>
  )
}
