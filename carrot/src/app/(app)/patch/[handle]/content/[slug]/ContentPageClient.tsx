'use client'

import { useRouter } from 'next/navigation'
import ContentModal from '../../components/ContentModal'
import { DiscoveredItem } from '@/types/discovered-content'

interface ContentPageClientProps {
  item: DiscoveredItem
}

export default function ContentPageClient({ item }: ContentPageClientProps) {
  const router = useRouter()

  const handleClose = () => {
    router.back()
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
