'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ContentModalV2 from '../[id]/ContentModalV2'
import { DiscoveredItem } from '@/types/discovered-content'
import CarrotSpinner from '@/components/ui/CarrotSpinner'

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
          <CarrotSpinner label="Loading content..." size={32} />
        </div>
      </div>
    )
  }

  return (
    <ContentModalV2 
      contentId={item.id}
      isOpen={true}
      onClose={handleClose}
    />
  )
}
