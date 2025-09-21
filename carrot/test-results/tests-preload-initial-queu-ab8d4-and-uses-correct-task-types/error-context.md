# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - heading "Test Preload Harness" [level=1] [ref=e3]
    - paragraph [ref=e4]: Records MediaPreloadQueue.enqueue() calls triggered by FeedMediaManager.setPosts()
    - generic [ref=e5]: "[ { \"postId\": \"cmftzcon50001nk2hl4zhzg3y\", \"type\": \"POSTER\", \"priority\": 1, \"feedIndex\": 0, \"url\": \"/api/img?bucket=test-bucket&path=cmftzcon50001nk2hl4zhzg3y/thumb.jpg\", \"bucket\": \"test-bucket\", \"path\": \"cmftzcon50001nk2hl4zhzg3y\" }, { \"postId\": \"cmftzcon50001nk2hl4zhzg3y\", \"type\": \"VIDEO_PREROLL_6S\", \"priority\": 1, \"feedIndex\": 0, \"url\": \"/api/video?bucket=test-bucket&path=cmftzcon50001nk2hl4zhzg3y/video.mp4\", \"bucket\": \"test-bucket\", \"path\": \"cmftzcon50001nk2hl4zhzg3y\" }, { \"postId\": \"cmftzcon5...\", \"type\": \"IMAGE\", \"priority\": 1, \"feedIndex\": 1, \"url\": \"/api/img?bucket=test-bucket&path=cmftzcon5...\", \"bucket\": \"test-bucket\", \"path\": \"cmftzcon5...\" }, { \"postId\": \"<7+ more real IDs>\", \"type\": \"TEXT_FULL\", \"priority\": 1, \"feedIndex\": 2, \"url\": \"/api/text?bucket=test-bucket&path=<7+ more real IDs>/content.json\", \"bucket\": \"test-bucket\", \"path\": \"<7+ more real IDs>\" } ]"
    - paragraph [ref=e6]: "Tip: Append ?ids=id1,id2,id3 to this URL to test with your real post IDs (no login required)."
  - button "Open Next.js Dev Tools" [ref=e12] [cursor=pointer]:
    - img [ref=e13] [cursor=pointer]
  - alert [ref=e16]
```