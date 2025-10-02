"use client"

import React, { useState, useRef, useEffect } from 'react'

type JobResult = {
  ok: boolean
  message?: string
  outputUrl?: string
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
  // Model is now chosen automatically by mode: prompt -> sd-lora, upload -> animeganv3
  const [model, setModel] = useState<'animeganv3' | 'sd-lora' | 'diffutoon'>('sd-lora')
  const [log, setLog] = useState<string>('Ready.')
  const [imageOut, setImageOut] = useState<string | null>(null)
  const [imageMeta, setImageMeta] = useState<any>(null)
  const [imageLoadError, setImageLoadError] = useState<boolean>(false)
  const [videoOut, setVideoOut] = useState<string | null>(null)
  const [origVideo, setOrigVideo] = useState<string | null>(null)
  const imgFileRef = useRef<HTMLInputElement>(null)
  const vidFileRef = useRef<HTMLInputElement>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [imageMode, setImageMode] = useState<'prompt' | 'upload'>('prompt')
  const [status, setStatus] = useState<any>(null)
  // LoRA: path is hidden; we just use whatever is on the worker when style preset requires it
  const [loraPath, setLoraPath] = useState<string>('')
  const [loraAlpha, setLoraAlpha] = useState<number>(1.0)
  const [loraOptions, setLoraOptions] = useState<string[]>([])
  // Style presets
  type StylePreset = { key: string; label: string; promptPrefix: string; negative: string; needsLora: boolean }
  const stylePresets: StylePreset[] = [
    {
      key: 'ghibli',
      label: 'Ghibli',
      promptPrefix: 'Studio Ghibli style, cel-shaded, soft pastel palette, clean lineart, anime screencap, cinematic lighting',
      negative: 'photorealistic, hyperrealistic, cgi, 3d, gritty, lowres, blurry, deformed, extra fingers, watermark, text, logo, nsfw',
      needsLora: true,
    },
    {
      key: 'miyazaki_pastel',
      label: 'Miyazaki Pastel',
      promptPrefix: 'soft pastel anime, gentle gradients, hand-painted feel, airy atmosphere, expressive eyes, subtle lineart, film-grain',
      negative: 'photorealistic, harsh contrast, glossy 3d render, cgi, lowres, blurry, deformed, extra fingers, watermark, text, logo, nsfw',
      needsLora: false,
    },
    {
      key: 'cel_anime_90s',
      label: 'Cel Anime 90s',
      promptPrefix: '90s cel anime, bold clean lineart, limited palette shading, flat cel shading, anime screencap, retro TV frame, halftone grain',
      negative: 'photorealistic, hyperrealistic, cinematic DOF, 3d render, noisy, extra limbs, watermark, text, logo, nsfw',
      needsLora: false,
    },
    {
      key: 'watercolor_anime',
      label: 'Watercolor Anime',
      promptPrefix: 'watercolor wash, soft bleeding pigments, paper texture, gentle linework, pastel anime aesthetic, storybook vibe',
      negative: 'photorealistic, glossy cgi, high contrast, noisy artifacts, extra fingers, watermark, text, logo, nsfw',
      needsLora: false,
    },
    {
      key: 'storybook_pastel',
      label: 'Storybook Pastel',
      promptPrefix: 'storybook illustration, pastel palette, soft outlines, simple shapes, cozy and whimsical, children book style',
      negative: 'photorealistic, harsh shadows, cgi render, cluttered details, watermark, text, logo, nsfw',
      needsLora: false,
    },
  ]
  const [styleKey, setStyleKey] = useState<string>('ghibli')

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

  useEffect(() => {
    const loadLoras = async () => {
      try {
        const r = await fetch('/api/ghibli/loras', { cache: 'no-store' })
        const j = await r.json()
        if (Array.isArray(j.items)) setLoraOptions(j.items)
      } catch {}
    }
    loadLoras()
  }, [])

  const appendLog = (line: string) => setLog((l) => l + "\n" + line)

  const submitImage = async () => {
    // Choose model by mode
    const chosenModel = imageMode === 'upload' ? 'animeganv3' : 'sd-lora'
    setModel(chosenModel)
    const preset = stylePresets.find(p => p.key === styleKey)!
    // Compose final prompt
    const finalPrompt = `${preset.promptPrefix}, ${prompt}` + (preset.negative ? ` --neg: ${preset.negative}` : '')
    const form = new FormData()
    form.append('prompt', finalPrompt)
    form.append('model', chosenModel)
    // If the preset expects a LoRA and the worker exposes any, include selection (optional)
    if (preset.needsLora && loraPath) form.append('lora', loraPath)
    if (preset.needsLora && loraAlpha !== undefined) form.append('lora_alpha', String(loraAlpha))
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
    const imageUrl = data.outputUrl || data.outputPath || null
    appendLog(`[Image] Output URL: ${imageUrl ? (imageUrl.length > 100 ? imageUrl.substring(0, 100) + '...' : imageUrl) : 'null'}`)
    setImageOut(imageUrl)
    setImageMeta(data.meta || null)
    setImageLoadError(false) // Reset error state
    setMetrics({ ...(data.meta || {}), durationMs: Math.round(t1 - t0), style: preset.label, mode: imageMode, model: chosenModel })
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
    setVideoOut(data.outputUrl || data.outputPath || null)
    setOrigVideo(data.meta?.originalPath || null)
    setMetrics({ ...(data.meta || {}), durationMs: Math.round(t1 - t0) })
  }

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Ghibli Style Lab</h1>
      <p>Minimal test bench for Ghibli-style image and video generation using open-source models.</p>

      {status && (
        <div style={{
          border: '1px solid ' + (status.canGenerateImages ? '#2e7d32' : status.fallbackMode ? '#f57c00' : '#8a1f11'),
          background: (status.canGenerateImages ? '#e8f5e9' : status.fallbackMode ? '#fff3e0' : '#fdecea'),
          color: (status.canGenerateImages ? '#1b5e20' : status.fallbackMode ? '#e65100' : '#611a15'),
          padding: 12, borderRadius: 8, marginBottom: 12
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <strong>Model Status</strong>
            <button onClick={async()=>{ setStatus(null); try{ const r=await fetch('/api/ghibli/status',{cache:'no-store'}); setStatus(await r.json()); }catch(e){ setStatus({ok:false,error:String(e)}) } }} style={{ padding:'4px 8px' }}>Refresh</button>
          </div>
          
          {/* Overall Status */}
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
            {status.canGenerateImages ? '✅ Ready for AI Generation' : 
             status.fallbackMode ? '⚠️ Fallback Mode (Placeholder Images)' : 
             '❌ Generation Unavailable'}
          </div>
          
          {/* Worker Status */}
          <div style={{ marginBottom: 4 }}>
            <strong>GPU Worker:</strong> 
            <span style={{ 
              color: status.workerStatus === 'healthy' ? '#4caf50' : 
                     status.workerStatus === 'unreachable' ? '#f44336' : 
                     status.workerStatus === 'unhealthy' ? '#ff9800' : '#9e9e9e',
              marginLeft: 8
            }}>
              {status.workerStatus === 'healthy' ? '✅ Healthy' :
               status.workerStatus === 'unreachable' ? '❌ Unreachable' :
               status.workerStatus === 'unhealthy' ? '⚠️ Unhealthy' :
               status.workerStatus === 'not_configured' ? '⚪ Not Configured' : status.workerStatus}
            </span>
            {status.workerResponseTime && (
              <span style={{ fontSize: '0.8em', color: '#666', marginLeft: 8 }}>
                ({status.workerResponseTime}ms)
              </span>
            )}
          </div>
          
          {/* Local Status */}
          <div style={{ marginBottom: 4 }}>
            <strong>Local SD:</strong> 
            <span style={{ 
              color: status.torch && status.loraExists ? '#4caf50' : '#f44336',
              marginLeft: 8
            }}>
              {status.torch && status.loraExists ? '✅ Available' : '❌ Unavailable'}
            </span>
          </div>
          
          {/* Technical Details */}
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.9em' }}>Technical Details</summary>
            <div style={{ marginTop: 8, fontSize: '0.8em' }}>
              <div>Python: {String(status.python)}</div>
              <div>Torch: {String(status.torch)}</div>
              <div>SD Model: {status.sdModel}</div>
              <div>LoRA path: {status.loraPath || '(not set)'}</div>
              <div>LoRA exists: {String(status.loraExists)}</div>
              <div>Device hint: {status.deviceHint}</div>
              {status.workerError && <div style={{ color: '#f44336' }}>Worker Error: {status.workerError}</div>}
              {status.torchError && <div style={{ color: '#f44336' }}>Torch Error: {status.torchError}</div>}
            </div>
          </details>
          
          {/* Recommendations */}
          {status.recommendations && Object.keys(status.recommendations).length > 0 && (
            <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
              <strong>Recommendations:</strong>
              {Object.entries(status.recommendations).map(([key, message]) => (
                <div key={key} style={{ fontSize: '0.8em', marginTop: 4 }}>
                  • {message}
                </div>
              ))}
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
            <li>Optional: specify a LoRA file path available on the worker and a strength.</li>
            <li><strong>Note:</strong> Prompt-only mode uses Stable Diffusion (requires AI model setup). Upload mode uses basic image processing.</li>
          </ol>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Upload an MP4 (max ~60s).</li>
            <li>Pick a style model.</li>
            <li>Click "Run Video Pipeline".</li>
          </ol>
        )}
      </Panel>

      <Panel title="Controls">
        <div style={{ display: 'grid', gap: 8 }}>
          {tab === 'image' && (
            <div>
              <strong>1) Mode</strong>
              <div style={{ display:'flex', gap:12, marginTop:6 }}>
                <label><input type="radio" name="imgmode" checked={imageMode==='prompt'} onChange={()=>setImageMode('prompt')} /> Prompt-only</label>
                <label><input type="radio" name="imgmode" checked={imageMode==='upload'} onChange={()=>setImageMode('upload')} /> Upload + Stylize</label>
              </div>
            </div>
          )}
          <label>
            <div>2) Prompt</div>
            <input value={prompt} onChange={(e)=>setPrompt(e.target.value)} style={{ width:'100%', padding:8 }} />
          </label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
              <span style={{ display:'block' }}>3) Style</span>
              <select value={styleKey} onChange={(e)=>setStyleKey(e.target.value)}>
                {stylePresets.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </label>

            {/* LoRA strength for styles that use LoRA; only relevant in Prompt-only (sd-lora) */}
            {imageMode==='prompt' && (
              <label title="LoRA strength: lower = subtler style; higher = stronger style but may distort anatomy (typical 0.6–1.0)">
                <span style={{ display:'block' }}>5) LoRA strength</span>
                <input type="range" min={0} max={1} step={0.05} value={loraAlpha} onChange={(e)=>setLoraAlpha(parseFloat(e.target.value))} title="LoRA strength: lower = subtler style; higher = stronger style but may distort anatomy (typical 0.6–1.0)" />
                <span style={{ marginLeft: 6 }}>{loraAlpha.toFixed(2)}</span>
              </label>
            )}
          </div>
          {tab === 'image' ? (
            <label>
              <div>6) Optional input image (disabled unless Upload + Stylize)</div>
              <input type="file" accept="image/*" ref={imgFileRef} disabled={imageMode!=='upload'} />
            </label>
          ) : (
            <div>
              <div>Input video (&lt;=60s, &lt;=720p)</div>
            </div>
          )}

          <div>
            {tab==='image' ? (
              <button 
                onClick={submitImage} 
                disabled={status && !status.canGenerateImages}
                style={{ 
                  padding:'8px 14px',
                  background: status && !status.canGenerateImages ? '#666' : '#007bff',
                  color: status && !status.canGenerateImages ? '#999' : '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: status && !status.canGenerateImages ? 'not-allowed' : 'pointer'
                }}
                title={status && !status.canGenerateImages ? 'AI generation unavailable. Check status above.' : 'Generate image using AI'}
              >
                7) Run Image Pipeline
                {status && !status.canGenerateImages && ' (Disabled)'}
              </button>
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
              {/* Show mode information */}
              {imageMeta?.fallback && (
                <div style={{ padding: '8px 12px', background: '#f0f9ff', border: '1px solid #0369a1', borderRadius: 6, fontSize: 14 }}>
                  <div style={{ color: '#0369a1', fontWeight: 'bold' }}>⚠️ AI Model Not Available</div>
                  <div style={{ color: '#0369a1', marginTop: 4 }}>
                    Stable Diffusion is not installed. Using basic image generation instead.
                    {imageMeta.originalModel && ` (Requested: ${imageMeta.originalModel})`}
                  </div>
                </div>
              )}
              {imageMeta?.reason === 'ENOSPC' && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #dc2626', borderRadius: 6, fontSize: 14 }}>
                  <div style={{ color: '#dc2626', fontWeight: 'bold' }}>💾 Server Out of Space</div>
                  <div style={{ color: '#dc2626', marginTop: 4 }}>
                    The server has run out of disk space. Please try again later or contact support.
                  </div>
                </div>
              )}
              <div style={{ display:'flex', gap:8 }}>
                <a href={imageOut + (imageOut.includes('?') ? '&' : '?') + 'download=1'}
                   download
                   style={{ padding:'6px 10px', background:'#333', color:'#fff', borderRadius:6, textDecoration:'none' }}>Download PNG</a>
                <a href={imageOut} target="_blank" rel="noreferrer"
                   style={{ padding:'6px 10px', background:'#555', color:'#fff', borderRadius:6, textDecoration:'none' }}>Open</a>
              </div>
              {imageLoadError ? (
                <div style={{ padding: '20px', background: '#fef2f2', border: '1px solid #dc2626', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: 8 }}>❌ Image Failed to Load</div>
                  <div style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>The generated image could not be displayed</div>
                  <div style={{ fontSize: 12, color: '#999', wordBreak: 'break-all' }}>
                    URL: {imageOut?.substring(0, 100)}...
                  </div>
                </div>
              ) : (
                <img 
                  src={imageOut} 
                  alt="output" 
                  style={{ maxWidth:'100%' }} 
                  onLoad={() => appendLog('[Image] Image loaded successfully')}
                  onError={(e) => {
                    appendLog('[Image] Failed to load image: ' + e.currentTarget.src.substring(0, 100) + '...')
                    console.error('Image load error:', e)
                    setImageLoadError(true)
                  }}
                />
              )}
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
