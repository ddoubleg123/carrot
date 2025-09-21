"use client";

import React, { useEffect, useState } from "react";
import FeedMediaManager, { type PostAsset as FMPostAsset } from "../../components/video/FeedMediaManager";
import MediaPreloadQueue, { TaskType, Priority } from "../../lib/MediaPreloadQueue";

// We construct 12 posts where the first 10 are either video or image (which the current
// FeedMediaManager.queuePostTasks() actually enqueues). Posts 10 and 11 are outside the
// initial window and should not be enqueued at initial setPosts().

type Kind = "video" | "image" | "text" | "audio";

function makePosts(): FMPostAsset[] {
  const posts: FMPostAsset[] = [];
  const kinds: Kind[] = [
    "video", "image", "video", "image", "video",
    "image", "video", "image", "video", "image", // 0..9
    "video", "image" // 10..11, outside initial-10 window
  ];

  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i];
    const common = {
      id: `post-${i}`,
      feedIndex: i,
      bucket: "test-bucket",
      path: `post-${i}`,
    } as Partial<FMPostAsset>;

    if (kind === "video") {
      posts.push({
        ...common,
        id: `post-${i}`,
        type: "video",
        thumbnailUrl: `/api/img?bucket=test-bucket&path=post-${i}/thumb.jpg` as any,
        videoUrl: `/api/video?bucket=test-bucket&path=post-${i}/video.mp4` as any,
        feedIndex: i,
      } as FMPostAsset);
    } else if (kind === "image") {
      posts.push({
        ...common,
        id: `post-${i}`,
        type: "image",
        thumbnailUrl: `/api/img?bucket=test-bucket&path=post-${i}` as any,
        feedIndex: i,
      } as FMPostAsset);
    } else if (kind === "text") {
      posts.push({
        ...common,
        id: `post-${i}`,
        type: "text",
        feedIndex: i,
      } as FMPostAsset);
    } else {
      posts.push({
        ...common,
        id: `post-${i}`,
        type: "audio",
        videoUrl: `/api/video?bucket=test-bucket&path=post-${i}/audio.mp3` as any,
        feedIndex: i,
      } as FMPostAsset);
    }
  }
  return posts;
}

export default function TestPreloadClient() {
  const [ready, setReady] = useState(false);
  const [enqueues, setEnqueues] = useState<any[]>([]);

  useEffect(() => {
    // Patch enqueue to record activity
    const mpq: any = MediaPreloadQueue as any;
    const originalEnqueue = mpq.enqueue.bind(mpq);
    const records: any[] = [];

    mpq.enqueue = (
      postId: string,
      type: TaskType,
      priority: Priority,
      feedIndex: number,
      url: string,
      bucket?: string,
      path?: string
    ) => {
      try {
        records.push({ postId, type, priority, feedIndex, url, bucket, path });
      } catch {}
      return originalEnqueue(postId, type, priority, feedIndex, url, bucket, path);
    };

    // Seed posts and trigger initial queuing
    const posts = makePosts();
    FeedMediaManager.inst.setPosts(posts);

    // Expose to window for Playwright and set component state for rendering
    const t = setTimeout(() => {
      try {
        (window as any).__mpq_enqueues = records;
        setEnqueues(records.slice());
        setReady(true);
      } catch {}
    }, 300);

    return () => {
      try { mpq.enqueue = originalEnqueue; } catch {}
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">Test Preload Harness</h1>
      <p className="text-sm text-gray-600">Records MediaPreloadQueue.enqueue() calls triggered by FeedMediaManager.setPosts()</p>
      <div data-testid="ready-flag" data-ready={ready ? "1" : "0"} />
      <pre id="enqueue-json" className="mt-4 whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded">
        {JSON.stringify(enqueues, null, 2)}
      </pre>
    </div>
  );
}
