'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import the CameraUploader component with no SSR
// const CameraUploader = dynamic(
//   () => import('@/components/enhanced/CameraUploader').then((mod) => mod.default),
//   { ssr: false }
// );

export default function TestCameraPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean | null>(null);

  const handleSave = async (blob: Blob, url: string) => {
    try {
      setIsUploading(true);
      setUploadSuccess(null);
      
      // Simulate an API call to upload the image
      console.log('Uploading image...', { size: blob.size, type: blob.type });
      
      // In a real app, you would upload the blob to your server here
      // For example:
      // const formData = new FormData();
      // formData.append('file', blob, 'profile.jpg');
      // const response = await fetch('/api/upload', {
      //   method: 'POST',
      //   body: formData,
      // });
      // const data = await response.json();
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo purposes, we'll just store the data URL
      setImageUrl(url);
      setUploadSuccess(true);
      console.log('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadSuccess(false);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Camera Uploader Test</h1>
          <p className="text-gray-600">
            Test the enhanced camera uploader with all features
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Camera Uploader</h2>
          
          <div className="mb-4">
            {/* <CameraUploader 
              onSave={handleSave}
              initialImage={imageUrl}
              maxSizeMB={5}
              aspectRatio={1}
              cropShape="round"
              showGrid={true}
             /> */}
          </div>
          
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <h3 className="font-medium mb-2">Upload Status:</h3>
            {isUploading ? (
              <div className="flex items-center text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span>Uploading image...</span>
              </div>
            ) : uploadSuccess === true ? (
              <div className="flex items-center text-green-600">
                <Check className="h-5 w-5 mr-2"  />
                <span>Image uploaded successfully!</span>
              </div>
            ) : uploadSuccess === false ? (
              <div className="flex items-center text-red-600">
                <X className="h-5 w-5 mr-2"  />
                <span>Failed to upload image. Please try again.</span>
              </div>
            ) : (
              <div className="text-gray-500">No image uploaded yet</div>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Features</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"  />
              <span>Camera capture with preview</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"  />
              <span>Front/Back camera toggle</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"  />
              <span>Flash on/off</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"  />
              <span>Zoom in/out</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"  />
              <span>Image cropping</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"  />
              <span>Drag & drop upload</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"  />
              <span>File size validation</span>
            </li>
            <li className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"  />
              <span>Responsive design</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
