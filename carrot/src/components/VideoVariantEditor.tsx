'use client';

import React, { useState } from 'react';
import { useVideoVariants } from '@/lib/videoDeduplicationClient';

interface VideoVariantEditorProps {
  isOpen: boolean;
  onClose: () => void;
  userVideo: any;
}

type OutputFormat = 'mp4' | 'webm' | 'mov';
type Quality = 'low' | 'medium' | 'high';

interface TextOverlay {
  text: string;
  x: number;
  y: number;
  startSec: number;
  endSec: number;
  fontSize: number;
  color: string;
}

interface EditManifest {
  cuts: Array<{ startSec: number; endSec: number }>;
  audioVolume: number;
  brightness: number;
  contrast: number;
  saturation: number;
  textOverlays: TextOverlay[];
  outputFormat: OutputFormat;
  quality: Quality;
}

export function VideoVariantEditor({ isOpen, onClose, userVideo }: VideoVariantEditorProps) {
  const { createVariant, isLoading, error } = useVideoVariants(userVideo?.id);
  const [editManifest, setEditManifest] = useState<EditManifest>({
    cuts: [{ startSec: 0, endSec: userVideo?.asset?.durationSec || 60 }],
    audioVolume: 1.0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    textOverlays: [],
    outputFormat: 'mp4',
    quality: 'medium'
  });

  const [newOverlay, setNewOverlay] = useState<TextOverlay>({
    text: '',
    x: 50,
    y: 50,
    startSec: 0,
    endSec: 10,
    fontSize: 24,
    color: 'white'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await createVariant(editManifest, 'edit');
    if (result) {
      onClose();
    }
  };

  const addTextOverlay = () => {
    if (newOverlay.text.trim()) {
      setEditManifest(prev => ({
        ...prev,
        textOverlays: [...prev.textOverlays, { ...newOverlay }]
      }));
      setNewOverlay({
        text: '',
        x: 50,
        y: 50,
        startSec: 0,
        endSec: 10,
        fontSize: 24,
        color: 'white'
      });
    }
  };

  const removeTextOverlay = (index: number) => {
    setEditManifest(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.filter((_, i) => i !== index)
    }));
  };

  if (!isOpen || !userVideo) return null;

  const maxDuration = userVideo.asset.durationSec || 60;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Edit Video</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Video Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">
                {userVideo.titleOverride || userVideo.asset.title || 'Untitled Video'}
              </h3>
              <p className="text-sm text-gray-600">
                Duration: {Math.floor(maxDuration / 60)}:{(maxDuration % 60).toString().padStart(2, '0')}
              </p>
            </div>

            {/* Trim Controls */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Trim</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time (seconds)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={maxDuration}
                    step="0.1"
                    value={editManifest.cuts[0]?.startSec || 0}
                    onChange={(e) => setEditManifest(prev => ({
                      ...prev,
                      cuts: [{ ...prev.cuts[0], startSec: parseFloat(e.target.value) || 0 }]
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time (seconds)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={maxDuration}
                    step="0.1"
                    value={editManifest.cuts[0]?.endSec || maxDuration}
                    onChange={(e) => setEditManifest(prev => ({
                      ...prev,
                      cuts: [{ ...prev.cuts[0], endSec: parseFloat(e.target.value) || maxDuration }]
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Audio Controls */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Audio</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Volume: {Math.round(editManifest.audioVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={editManifest.audioVolume}
                  onChange={(e) => setEditManifest(prev => ({
                    ...prev,
                    audioVolume: parseFloat(e.target.value)
                  }))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Video Adjustments */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Video Adjustments</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brightness: {Math.round(editManifest.brightness * 100)}
                  </label>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={editManifest.brightness}
                    onChange={(e) => setEditManifest(prev => ({
                      ...prev,
                      brightness: parseFloat(e.target.value)
                    }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contrast: {Math.round(editManifest.contrast * 100)}
                  </label>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={editManifest.contrast}
                    onChange={(e) => setEditManifest(prev => ({
                      ...prev,
                      contrast: parseFloat(e.target.value)
                    }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Saturation: {Math.round(editManifest.saturation * 100)}
                  </label>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={editManifest.saturation}
                    onChange={(e) => setEditManifest(prev => ({
                      ...prev,
                      saturation: parseFloat(e.target.value)
                    }))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Text Overlays */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Text Overlays</h3>
              
              {/* Existing overlays */}
              {editManifest.textOverlays.map((overlay, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded border">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium">"{overlay.text}"</span>
                    <button
                      type="button"
                      onClick={() => removeTextOverlay(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="text-sm text-gray-600">
                    Position: {overlay.x}%, {overlay.y}% • 
                    Time: {overlay.startSec}s - {overlay.endSec}s • 
                    Size: {overlay.fontSize}px
                  </div>
                </div>
              ))}

              {/* Add new overlay */}
              <div className="border border-dashed border-gray-300 p-4 rounded">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Overlay text"
                    value={newOverlay.text}
                    onChange={(e) => setNewOverlay(prev => ({ ...prev, text: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={newOverlay.color}
                    onChange={(e) => setNewOverlay(prev => ({ ...prev, color: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="white">White</option>
                    <option value="black">Black</option>
                    <option value="red">Red</option>
                    <option value="blue">Blue</option>
                    <option value="yellow">Yellow</option>
                  </select>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <input
                    type="number"
                    placeholder="X %"
                    min="0"
                    max="100"
                    value={newOverlay.x}
                    onChange={(e) => setNewOverlay(prev => ({ ...prev, x: parseInt(e.target.value) || 0 }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Y %"
                    min="0"
                    max="100"
                    value={newOverlay.y}
                    onChange={(e) => setNewOverlay(prev => ({ ...prev, y: parseInt(e.target.value) || 0 }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Start (s)"
                    min="0"
                    max={maxDuration}
                    value={newOverlay.startSec}
                    onChange={(e) => setNewOverlay(prev => ({ ...prev, startSec: parseInt(e.target.value) || 0 }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="End (s)"
                    min="0"
                    max={maxDuration}
                    value={newOverlay.endSec}
                    onChange={(e) => setNewOverlay(prev => ({ ...prev, endSec: parseInt(e.target.value) || 10 }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={addTextOverlay}
                  disabled={!newOverlay.text.trim()}
                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Overlay
                </button>
              </div>
            </div>

            {/* Output Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Output Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quality
                  </label>
                  <select
                    value={editManifest.quality}
                    onChange={(e) => setEditManifest(prev => ({
                      ...prev,
                      quality: e.target.value as 'low' | 'medium' | 'high'
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low (Fast)</option>
                    <option value="medium">Medium</option>
                    <option value="high">High (Slow)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Format
                  </label>
                  <select
                    value={editManifest.outputFormat}
                    onChange={(e) => setEditManifest(prev => ({
                      ...prev,
                      outputFormat: e.target.value as 'mp4' | 'webm' | 'mov'
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mp4">MP4</option>
                    <option value="webm">WebM</option>
                    <option value="mov">MOV</option>
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : 'Create Variant'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
