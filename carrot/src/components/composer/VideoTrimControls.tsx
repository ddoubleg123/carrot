import React from 'react';

interface VideoTrimControlsProps {
  videoDuration: number;
  videoTrimStart: number;
  videoTrimEnd: number;
  trimTrackRef: React.RefObject<HTMLDivElement>;
  setDraggingHandle: (h: 'start' | 'end') => void;
}

export default function VideoTrimControls({
  videoDuration,
  videoTrimStart,
  videoTrimEnd,
  trimTrackRef,
  setDraggingHandle,
}: VideoTrimControlsProps) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-gray-700 mb-1">
        <span>Start: {videoTrimStart.toFixed(2)}s</span>
        <span>End: {videoTrimEnd.toFixed(2)}s</span>
        <span>Duration: {videoDuration.toFixed(2)}s</span>
      </div>
      <div ref={trimTrackRef} className="relative w-full h-3 mb-4 rounded bg-gray-200 overflow-hidden select-none touch-none">
        <div
          className="absolute top-0 left-0 h-full bg-gray-400/60"
          style={{ width: `${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}%` }}
        />
        <div
          className="absolute top-0 right-0 h-full bg-gray-400/60"
          style={{ width: `${videoDuration ? ((videoDuration - Math.max(videoTrimEnd, videoTrimStart)) / videoDuration) * 100 : 0}%` }}
        />
        <div
          className="absolute top-0 h-full bg-orange-500/50"
          style={{
            left: `${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}%`,
            width: `${videoDuration ? ((Math.max(videoTrimEnd, videoTrimStart) - Math.min(videoTrimStart, videoTrimEnd)) / videoDuration) * 100 : 0}%`
          }}
        />
        {/* Start handle */}
        <button
          type="button"
          aria-label="Trim start"
          onMouseDown={() => setDraggingHandle('start')}
          onTouchStart={() => setDraggingHandle('start')}
          className="absolute -top-4 w-10 h-10 z-10 bg-transparent cursor-ew-resize transform -translate-x-1/2 touch-none"
          style={{ left: `${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}%` }}
        >
          <span className="pointer-events-none absolute inset-0 m-auto w-4 h-6 bg-white border-2 border-orange-500 rounded-md shadow-lg ring-2 ring-orange-300 ring-offset-2 ring-offset-white" />
        </button>
        {/* End handle */}
        <button
          type="button"
          aria-label="Trim end"
          onMouseDown={() => setDraggingHandle('end')}
          onTouchStart={() => setDraggingHandle('end')}
          className="absolute -top-4 w-10 h-10 z-10 bg-transparent cursor-ew-resize transform -translate-x-1/2 touch-none"
          style={{ left: `${videoDuration ? (Math.max(videoTrimEnd, videoTrimStart) / videoDuration) * 100 : 0}%` }}
        >
          <span className="pointer-events-none absolute inset-0 m-auto w-4 h-6 bg-white border-2 border-red-500 rounded-md shadow-lg ring-2 ring-red-300 ring-offset-2 ring-offset-white" />
        </button>
        <div className="absolute -top-5 text-orange-600 text-lg select-none" style={{ left: `calc(${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}% - 6px)` }}>⟪</div>
        <div className="absolute -top-5 text-red-600 text-lg select-none" style={{ left: `calc(${videoDuration ? (Math.max(videoTrimEnd, videoTrimStart) / videoDuration) * 100 : 0}% - 6px)` }}>⟫</div>
      </div>
      <div className="mt-1 text-xs text-gray-600">Selected clip: {(Math.max(0, videoTrimEnd - videoTrimStart)).toFixed(2)}s</div>
    </div>
  );
}
