import React, { createContext, useContext, useMemo, useState } from 'react';

export type VideoState = {
  playingVideoId: string | null;
  currentTime: number;
  setPlayingVideoId: (id: string | null) => void;
  setCurrentTime: (t: number) => void;
};

const defaultState: VideoState = {
  playingVideoId: null,
  currentTime: 0,
  setPlayingVideoId: () => {},
  setCurrentTime: () => {},
};

const Ctx = createContext<VideoState>(defaultState);

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const value = useMemo<VideoState>(() => ({
    playingVideoId,
    currentTime,
    setPlayingVideoId,
    setCurrentTime,
  }), [playingVideoId, currentTime]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVideoContext() {
  return useContext(Ctx);
}
