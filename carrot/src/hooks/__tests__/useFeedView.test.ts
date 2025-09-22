/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFeedView } from '../useFeedView';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useFeedView', () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useFeedView());
    
    expect(result.current.view).toBe('foryou');
    expect(result.current.selectedTopics).toEqual([]);
    expect(result.current.excludedTopics).toEqual([]);
    expect(result.current.liveCount).toBe(0);
  });

  it('should parse URL parameters correctly', () => {
    const searchParams = new URLSearchParams('?view=subjects&topics=tech,politics&exclude=crypto');
    (useSearchParams as jest.Mock).mockReturnValue(searchParams);

    const { result } = renderHook(() => useFeedView());
    
    expect(result.current.view).toBe('subjects');
    expect(result.current.selectedTopics).toEqual(['tech', 'politics']);
    expect(result.current.excludedTopics).toEqual(['crypto']);
  });

  it('should update URL when view changes', () => {
    const { result } = renderHook(() => useFeedView());
    
    act(() => {
      result.current.setView('following');
    });

    expect(mockReplace).toHaveBeenCalledWith('?view=following', { scroll: false });
  });

  it('should toggle topics correctly', () => {
    const { result } = renderHook(() => useFeedView());
    
    act(() => {
      result.current.toggleTopic('tech');
    });

    expect(result.current.selectedTopics).toEqual(['tech']);
    expect(mockReplace).toHaveBeenCalledWith('?topics=tech', { scroll: false });
  });

  it('should exclude topics correctly', () => {
    const { result } = renderHook(() => useFeedView());
    
    act(() => {
      result.current.excludeTopic('crypto');
    });

    expect(result.current.excludedTopics).toEqual(['crypto']);
    expect(mockReplace).toHaveBeenCalledWith('?exclude=crypto', { scroll: false });
  });

  it('should clear filters correctly', () => {
    const searchParams = new URLSearchParams('?view=subjects&topics=tech&exclude=crypto');
    (useSearchParams as jest.Mock).mockReturnValue(searchParams);

    const { result } = renderHook(() => useFeedView());
    
    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.selectedTopics).toEqual([]);
    expect(result.current.excludedTopics).toEqual([]);
    expect(mockReplace).toHaveBeenCalledWith('?view=subjects', { scroll: false });
  });
});
