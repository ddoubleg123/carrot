import { MinimalImageUploader } from '@/components/MinimalImageUploader';

export default function TestUploadPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">Minimal Image Uploader Test</h1>
        <MinimalImageUploader />
      </div>
    </div>
  );
}
