'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ContentModal from '../../components/ContentModal'
import { DiscoveredItem } from '@/types/discovered-content'

interface ContentPageClientProps {
  item: DiscoveredItem
}

export default function ContentPageClient({ item }: ContentPageClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Small delay to show loading state for better UX
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    router.back()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ContentModal 
        item={item}
        isOpen={true}
        onClose={handleClose}
      />
    </div>
  )
}
