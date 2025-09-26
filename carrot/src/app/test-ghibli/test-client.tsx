"use client"

import React, { useState, useRef, useEffect } from 'react'

type JobResult = {
  ok: boolean
  message?: string
  outputPath?: string
  meta?: any
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #333', borderRadius: 8, padding: 16, marginTop: 16 }}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>{title}</h3>
      {children}
    </div>
  )
}

export default function TestGhibliClient() {
  const [tab, setTab] = useState<'image' | 'video'>('image')
  const [prompt, setPrompt] = useState('Ghibli style, peaceful countryside with windmills at sunset')
  const [model, setModel] = useState<'animeganv3' | 'sd-lora' | 'diffutoon'>('sd-lora')
  const [log, setLog] = useState<string>('Ready.')
  const [imageOut, setImageOut] = useState<string | null>(null)
  const [videoOut, setVideoOut] = useState<string | null>(null)
  const [origVideo, setOrigVideo] = useState<string | null>(null)
  const imgFileRef = useRef<HTMLInputElement>(null)
  const vidFileRef = useRef<HTMLInputElement>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [imageMode, setImageMode] = useState<'prompt' | 'upload'>('prompt')
  const [status, setStatus] = useState<any>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch('/api/ghibli/status', { cache: 'no-store' })
        const j = await r.json()
        setStatus(j)
      } catch (e) {
        setStatus({ ok: false, error: String(e) })
      }
    }
    run()
  }, [])

  const appendLog = (line: string) => setLog((l) => l + "\n" + line)

  const submitImage = async () => {
    const form = new FormData()
    form.append('prompt', prompt)
    form.append('model', model)
    if (imageMode === 'upload' && imgFileRef.current?.files?.[0]) {
      form.append('image', imgFileRef.current.files[0])
    }
    const t0 = performance.now()
    appendLog('[Image] Submitting job...')
    if (imageMode === 'prompt' || !imgFileRef.current?.files?.[0]) {
      appendLog('[Image] No upload provided: will generate a prompt-based PNG placeholder (Pillow not required).')
    }
    const res = await fetch('/api/ghibli/image', { method: 'POST', body: form })
    const t1 = performance.now()
    const data: JobResult = await res.json()
    if (!data.ok) {
      const msg = data.message || res.statusText
      appendLog('[Image] Failed: ' + msg)
      if (/Pillow|PIL not installed/i.test(msg)) {
        appendLog('[Hint] Prompt-only mode works without uploads. To enable uploaded image processing, install Pillow on the backend (pip install -r scripts/ghibli/requirements.txt).')
      }
      return
    }
    appendLog(`[Image] Done in ${(t1 - t0).toFixed(0)}ms`)
    setImageOut(data.outputPath || null)
    setMetrics({ ...(data.meta || {}), durationMs: Math.round(t1 - t0) })
  }

  const submitVideo = async () => {
    const form = new FormData()
    form.append('prompt', prompt)
    form.append('model', model)
    const file = vidFileRef.current?.files?.[0]
    if (!file) { appendLog('[Video] Please choose a file'); return }
    form.append('video', file)
    const t0 = performance.now()
    appendLog('[Video] Submitting job...')
    const res = await fetch('/api/ghibli/video', { method: 'POST', body: form })
    const t1 = performance.now()
    const data: JobResult = await res.json()
    if (!data.ok) {
      appendLog('[Video] Failed: ' + (data.message || res.statusText))
      return
    }
    appendLog(`[Video] Done in ${(t1 - t0).toFixed(0)}ms`)
    setVideoOut(data.outputPath || null)
    setOrigVideo(data.meta?.originalPath || null)
    setMetrics({ ...(data.meta || {}), durationMs: Math.round(t1 - t0) })
  }

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Ghibli Style Lab</h1>
      <p>Minimal test bench for Ghibli-style image and video generation using open-source models.</p>

      {status && (
        <div style={{
          border: '1px solid ' + (status.torch && status.loraExists ? '#2e7d32' : '#8a1f11'),
          background: (status.torch && status.loraExists ? '#e8f5e9' : '#fdecea'),
          color: (status.torch && status.loraExists ? '#1b5e20' : '#611a15'),
          padding: 12, borderRadius: 8, marginBottom: 12
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <strong>Model Status</strong>
            <button onClick={async()=>{ setStatus(null); try{ const r=await fetch('/api/ghibli/status',{cache:'no-store'}); setStatus(await r.json()); }catch(e){ setStatus({ok:false,error:String(e)}) } }} style={{ padding:'4px 8px' }}>Refresh</button>
          </div>
          <div>Python: {String(status.python)}</div>
          <div>Torch: {String(status.torch)}</div>
          <div>SD Model: {status.sdModel}</div>
          <div>LoRA path: {status.loraPath || '(not set)'}</div>
          <div>LoRA exists: {String(status.loraExists)}</div>
          <div>Device hint: {status.deviceHint}</div>
          {(!status.torch || !status.loraExists) && (
            <div style={{ marginTop: 6 }}>
              {!status.torch && <div>Install SD deps on the server (GPU recommended): see scripts/ghibli/requirements-sd.txt and matching torch wheel for your CUDA.</div>}
              {!status.loraExists && <div>Set GHIBLI_LORA_WEIGHTS to a valid .safetensors path on the server.</div>}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setTab('image')} style={{ padding: '8px 12px', background: tab==='image'?'#111':'#333', color:'#fff', border:0, borderRadius:6 }}>Image Generator</button>
        <button disabled title="Temporarily disabled while we focus on images" style={{ padding: '8px 12px', background:'#555', color:'#aaa', border:0, borderRadius:6, cursor:'not-allowed' }}>Video Animator</button>
      </div>

      <Panel title={tab === 'image' ? 'How to use (Image)' : 'How to use (Video)'}>
        {tab === 'image' ? (
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Enter a prompt (required).</li>
            <li>Choose mode: Prompt-only (no upload) or Upload + Stylize.</li>
            <li>Prompt-only works everywhere and returns a PNG quickly. Upload + Stylize requires Pillow on the backend (and an AnimeGAN command if configured).</li>
            <li>Click "Run Image Pipeline".</li>
          </ol>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Enter a prompt (optional).</li>
            <li>Upload a video (≤60s, ≤720p target). The server pre-limits automatically.</li>
            <li>Click "Run Video Pipeline" to stylize and preview original vs stylized.</li>
          </ol>
        )}
      </Panel>

      <Panel title="Controls">
        <div style={{ display: 'grid', gap: 8 }}>
          {tab === 'image' && (
            <div>
              <strong>Mode</strong>
              <div style={{ display:'flex', gap:12, marginTop:6 }}>
                <label><input type="radio" name="imgmode" checked={imageMode==='prompt'} onChange={()=>setImageMode('prompt')} /> Prompt-only</label>
                <label><input type="radio" name="imgmode" checked={imageMode==='upload'} onChange={()=>setImageMode('upload')} /> Upload + Stylize</label>
              </div>
            </div>
          )}
          <label>
            <div>Prompt</div>
            <input value={prompt} onChange={(e)=>setPrompt(e.target.value)} style={{ width:'100%', padding:8 }} />
          </label>
          <label>
            <div>Model</div>
            <select value={model} onChange={(e)=>setModel(e.target.value as any)}>
              <option value="animeganv3">AnimeGANv3 (fast)</option>
              <option value="sd-lora">Stable Diffusion + Ghibli LoRA</option>
              <option value="diffutoon">Diffutoon (slow)</option>
            </select>
          </label>
          {tab === 'image' ? (
            <label>
              <div>Optional input image (disabled unless Upload + Stylize)</div>
              <input type="file" accept="image/*" ref={imgFileRef} disabled={imageMode!=='upload'} />
            </label>
          ) : (
            <label>
              <div>Input video (&lt;=60s, &lt;=720p)</div>
              <input type="file" accept="video/*" ref={vidFileRef} />
            </label>
          )}

          <div>
            {tab==='image' ? (
              <button onClick={submitImage} style={{ padding:'8px 14px' }}>Run Image Pipeline</button>
            ) : (
              <button onClick={submitVideo} style={{ padding:'8px 14px' }}>Run Video Pipeline</button>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Output Preview">
        {tab==='image' ? (
          imageOut ? (
            <div style={{ display:'grid', gap:8 }}>
              <div style={{ display:'flex', gap:8 }}>
                <a href={imageOut + (imageOut.includes('?') ? '&' : '?') + 'download=1'}
                   download
                   style={{ padding:'6px 10px', background:'#333', color:'#fff', borderRadius:6, textDecoration:'none' }}>Download PNG</a>
                <a href={imageOut} target="_blank" rel="noreferrer"
                   style={{ padding:'6px 10px', background:'#555', color:'#fff', borderRadius:6, textDecoration:'none' }}>Open</a>
              </div>
              <img src={imageOut} alt="output" style={{ maxWidth:'100%' }} />
            </div>
          ) : <div>No image yet.</div>
        ) : (
          videoOut ? (
            <div style={{ display:'grid', gap:12 }}>
              {origVideo && (
                <div>
                  <div>Original</div>
                  <video src={origVideo} controls style={{ width:'100%' }} />
                </div>
              )}
              <div>
                <div>Stylized</div>
                <video src={videoOut} controls style={{ width:'100%' }} />
              </div>
            </div>
          ) : <div>No video yet.</div>
        )}
      </Panel>

      <Panel title="Logs & Metrics">
        <pre style={{ whiteSpace:'pre-wrap', background:'#111', color:'#0f0', padding:12, borderRadius:6, maxHeight:240, overflow:'auto' }}>{log}</pre>
        {metrics && (
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            <div>Model: {model}</div>
            {metrics.durationMs ? <div>Duration: {metrics.durationMs} ms</div> : null}
            {metrics.frames ? <div>Frames: {metrics.frames}</div> : null}
            {metrics.fps ? <div>FPS: {metrics.fps}</div> : null}
            {metrics.size ? <div>Size: {metrics.size}</div> : null}
          </div>
        )}
      </Panel>
    </div>
  )
}
