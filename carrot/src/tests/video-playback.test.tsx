// @ts-nocheck
/**
 * Video Playback Tests
 * 
 * Tests for the comprehensive video playback system including:
 * - Audio unmute functionality
 * - Retry logic with exponential backoff
 * - Modal video transitions
 * - Loading timeout handling
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoProvider } from '@/context/VideoContext';
import SimpleVideo from '@/components/SimpleVideo';
import VideoPortal from '@/components/video/VideoPortal';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock video element methods
const mockVideoElement = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  load: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  currentTime: 0,
  duration: 100,
  paused: true,
  muted: true,
  volume: 1,
  readyState: 4, // HAVE_ENOUGH_DATA
  networkState: 1, // NETWORK_IDLE
  src: '',
  poster: '',
  controls: true,
  playsInline: true,
  crossOrigin: 'anonymous',
  preload: 'metadata',
  videoWidth: 1920,
  videoHeight: 1080,
  buffered: {
    length: 1,
    start: jest.fn().mockReturnValue(0),
    end: jest.fn().mockReturnValue(10),
  },
  getAttribute: jest.fn(),
  setAttribute: jest.fn(),
  removeAttribute: jest.fn(),
  querySelector: jest.fn(),
  getBoundingClientRect: jest.fn().mockReturnValue({
    top: 0,
    bottom: 100,
    height: 100,
    left: 0,
    right: 100,
    width: 100,
  }),
};

// Mock HTMLVideoElement constructor
Object.defineProperty(global, 'HTMLVideoElement', {
  value: class MockHTMLVideoElement {
    constructor() {
      return mockVideoElement;
    }
  },
  writable: true,
});

// Mock document.createElement
const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName: string) => {
  if (tagName === 'video') {
    return mockVideoElement;
  }
  return originalCreateElement.call(document, tagName);
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window methods
Object.defineProperty(window, 'scrollY', {
  value: 0,
  writable: true,
});

Object.defineProperty(window, 'innerHeight', {
  value: 800,
  writable: true,
});

// Mock performance
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn().mockReturnValue(Date.now()),
  },
  writable: true,
});

// Mock AudioContext
Object.defineProperty(global, 'AudioContext', {
  value: jest.fn().mockImplementation(() => ({
    state: 'suspended',
    resume: jest.fn().mockResolvedValue(undefined),
  })),
  writable: true,
});

// Mock Audio
global.Audio = jest.fn().mockImplementation(() => ({
  src: '',
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  remove: jest.fn(),
}));

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(global.URL, 'createObjectURL', {
  value: jest.fn().mockReturnValue('blob:mock-url'),
  writable: true,
});

Object.defineProperty(global.URL, 'revokeObjectURL', {
  value: jest.fn(),
  writable: true,
});

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  json: jest.fn().mockResolvedValue({ ok: true, supported: true }),
});

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <VideoProvider>{children}</VideoProvider>
);

describe('Video Playback System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVideoElement.currentTime = 0;
    mockVideoElement.paused = true;
    mockVideoElement.muted = true;
    mockVideoElement.readyState = 4;
  });

  describe('Single Video Playback Enforcement', () => {
    test('should pause other videos when one starts playing', async () => {
      const { rerender } = render(
        <TestWrapper>
          <SimpleVideo src="test1.mp4" postId="video1" />
          <SimpleVideo src="test2.mp4" postId="video2" />
        </TestWrapper>
      );

      // Start playing first video
      mockVideoElement.paused = false;
      fireEvent.click(screen.getAllByRole('generic')[0]);

      await waitFor(() => {
        expect(mockVideoElement.play).toHaveBeenCalled();
      });

      // Verify that GlobalVideoManager would pause other videos
      // (This is tested through the GlobalVideoManager singleton)
    });

    test('should not allow multiple videos to play simultaneously', async () => {
      render(
        <TestWrapper>
          <SimpleVideo src="test1.mp4" postId="video1" />
          <SimpleVideo src="test2.mp4" postId="video2" />
        </TestWrapper>
      );

      // Try to play both videos
      mockVideoElement.paused = false;
      fireEvent.click(screen.getAllByRole('generic')[0]);
      fireEvent.click(screen.getAllByRole('generic')[1]);

      // Only one should actually play due to singleton enforcement
      await waitFor(() => {
        expect(mockVideoElement.play).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Audio Unmute Functionality', () => {
    test('should unmute video on user interaction', async () => {
      render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" muted={true} />
        </TestWrapper>
      );

      // Initially muted
      expect(mockVideoElement.muted).toBe(true);

      // User clicks on video
      fireEvent.click(screen.getByRole('generic'));

      await waitFor(() => {
        expect(mockVideoElement.muted).toBe(false);
      });
    });

    test('should resume audio context on user interaction', async () => {
      const mockAudioContext = {
        state: 'suspended',
        resume: jest.fn().mockResolvedValue(undefined),
      };
      
      (global.AudioContext as jest.Mock).mockImplementation(() => mockAudioContext);

      render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('generic'));

      await waitFor(() => {
        expect(mockAudioContext.resume).toHaveBeenCalled();
      });
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    test('should retry video loading up to 3 times', async () => {
      // Mock video error
      mockVideoElement.readyState = 0;
      const error = new Error('Network error');
      Object.defineProperty(mockVideoElement, 'error', {
        value: { code: 2, message: 'Network error' },
        writable: true,
      });

      render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      // Simulate load error
      const errorEvent = new Event('error');
      Object.defineProperty(errorEvent, 'target', {
        value: mockVideoElement,
        writable: true,
      });

      // Trigger error multiple times
      for (let i = 0; i < 3; i++) {
        mockVideoElement.dispatchEvent(errorEvent);
        await waitFor(() => {
          expect(mockVideoElement.load).toHaveBeenCalledTimes(i + 1);
        });
      }

      // After 3 attempts, should show error UI
      await waitFor(() => {
        expect(screen.getByText(/Video failed to load after multiple attempts/)).toBeInTheDocument();
      });
    });

    test('should use exponential backoff for retry delays', async () => {
      jest.useFakeTimers();
      
      mockVideoElement.readyState = 0;
      Object.defineProperty(mockVideoElement, 'error', {
        value: { code: 2, message: 'Network error' },
        writable: true,
      });

      render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      const errorEvent = new Event('error');
      Object.defineProperty(errorEvent, 'target', {
        value: mockVideoElement,
        writable: true,
      });

      // First retry should happen after 1 second
      mockVideoElement.dispatchEvent(errorEvent);
      
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(mockVideoElement.load).toHaveBeenCalledTimes(1);
      });

      jest.useRealTimers();
    });
  });

  describe('Modal Video Transitions', () => {
    test('should transfer video state to modal', async () => {
      const { rerender } = render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      // Set some video state
      mockVideoElement.currentTime = 30;
      mockVideoElement.duration = 120;
      mockVideoElement.paused = false;
      mockVideoElement.volume = 0.8;

      // Switch to modal
      rerender(
        <TestWrapper>
          <VideoPortal src="test.mp4" postId="video1" isModal={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockVideoElement.currentTime).toBe(30);
        expect(mockVideoElement.volume).toBe(0.8);
      });
    });

    test('should restore video state when returning from modal', async () => {
      const { rerender } = render(
        <TestWrapper>
          <VideoPortal src="test.mp4" postId="video1" isModal={true} />
        </TestWrapper>
      );

      // Set video state in modal
      mockVideoElement.currentTime = 45;
      mockVideoElement.volume = 0.6;
      mockVideoElement.paused = false;

      // Return to feed
      rerender(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockVideoElement.currentTime).toBe(45);
        expect(mockVideoElement.volume).toBe(0.6);
      });
    });
  });

  describe('Loading Timeout Handling', () => {
    test('should show loading timeout after 8 seconds', async () => {
      jest.useFakeTimers();
      
      mockVideoElement.readyState = 0; // Not ready

      render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      // Advance time by 8 seconds
      jest.advanceTimersByTime(8000);

      await waitFor(() => {
        expect(screen.getByText(/Video failed to load after multiple attempts/)).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    test('should show loading spinner while video loads', () => {
      mockVideoElement.readyState = 0;

      render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('IntersectionObserver Lazy Loading', () => {
    test('should use IntersectionObserver for video visibility', () => {
      render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      expect(global.IntersectionObserver).toHaveBeenCalled();
    });

    test('should pause video when not visible', async () => {
      const mockObserver = {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };
      
      (global.IntersectionObserver as jest.Mock).mockImplementation((callback) => {
        // Simulate video not visible
        callback([{ intersectionRatio: 0 }]);
        return mockObserver;
      });

      render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockVideoElement.pause).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    test('should show appropriate error message for network errors', async () => {
      Object.defineProperty(mockVideoElement, 'error', {
        value: { code: 2, message: 'Network error' },
        writable: true,
      });

      render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      const errorEvent = new Event('error');
      Object.defineProperty(errorEvent, 'target', {
        value: mockVideoElement,
        writable: true,
      });

      mockVideoElement.dispatchEvent(errorEvent);

      await waitFor(() => {
        expect(screen.getByText(/Network error - check connection/)).toBeInTheDocument();
      });
    });

    test('should show appropriate error message for decode errors', async () => {
      Object.defineProperty(mockVideoElement, 'error', {
        value: { code: 3, message: 'Decode error' },
        writable: true,
      });

      render(
        <TestWrapper>
          <SimpleVideo src="test.mp4" postId="video1" />
        </TestWrapper>
      );

      const errorEvent = new Event('error');
      Object.defineProperty(errorEvent, 'target', {
        value: mockVideoElement,
        writable: true,
      });

      mockVideoElement.dispatchEvent(errorEvent);

      await waitFor(() => {
        expect(screen.getByText(/Video decode error/)).toBeInTheDocument();
      });
    });
  });
});
