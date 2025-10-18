import AIImageBackfill from '@/components/dev/AIImageBackfill'

export default function AIImagesPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">AI Image Generation</h1>
          <p className="text-gray-600 mt-2">
            Generate AI images for discovered content in Carrot patches
          </p>
        </div>
        
        <AIImageBackfill patchHandle="chicago-bulls" />
      </div>
    </div>
  )
}
