// Server-side media extraction utilities
import { writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Extract video frame using ffmpeg (server-side)
 */
export async function extractVideoFrame(videoUrl: string): Promise<string | null> {
  try {
    console.log('[extractVideoFrame] Extracting frame from:', videoUrl.substring(0, 50))
    
    // Check if FFmpeg is available
    try {
      await execAsync('ffmpeg -version')
    } catch {
      console.warn('[extractVideoFrame] FFmpeg not available on system')
      return null
    }

    // Create temp directory
    const tempDir = join(process.cwd(), 'temp', 'hero-extraction')
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    const timestamp = Date.now()
    const inputPath = join(tempDir, `video_${timestamp}.mp4`)
    const outputPath = join(tempDir, `frame_${timestamp}.jpg`)

    try {
      // Download video to temp file
      console.log('[extractVideoFrame] Downloading video...')
      const response = await fetch(videoUrl, { 
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })
      
      if (!response.ok) {
        console.warn('[extractVideoFrame] Failed to download video:', response.status)
        return null
      }

      const videoBuffer = await response.arrayBuffer()
      await writeFile(inputPath, Buffer.from(videoBuffer))
      console.log('[extractVideoFrame] Video saved to:', inputPath)

      // Get video duration
      const durationCommand = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${inputPath}"`
      let duration = 5 // Default fallback
      
      try {
        const { stdout: durationOutput } = await execAsync(durationCommand)
        duration = parseFloat(durationOutput.trim())
        console.log('[extractVideoFrame] Video duration:', duration, 'seconds')
      } catch {
        console.warn('[extractVideoFrame] Could not get duration, using midpoint guess')
      }

      // Extract frame at midpoint
      const midpoint = duration / 2
      const ffmpegCommand = [
        'ffmpeg',
        '-ss', midpoint.toFixed(2),
        '-i', `"${inputPath}"`,
        '-vframes', '1',
        '-vf', 'scale=1280:-2', // Scale to 1280px width, maintain aspect ratio
        '-q:v', '2', // High quality
        '-y',
        `"${outputPath}"`
      ].join(' ')

      console.log('[extractVideoFrame] Running ffmpeg:', ffmpegCommand)
      await execAsync(ffmpegCommand)

      // Read the extracted frame
      const { readFile } = await import('fs/promises')
      const frameBuffer = await readFile(outputPath)
      const frameBase64 = frameBuffer.toString('base64')
      
      console.log('[extractVideoFrame] Frame extracted successfully')

      // Cleanup
      await unlink(inputPath).catch(() => {})
      await unlink(outputPath).catch(() => {})

      return `data:image/jpeg;base64,${frameBase64}`

    } catch (error) {
      console.error('[extractVideoFrame] Extraction failed:', error)
      // Cleanup on error
      await unlink(inputPath).catch(() => {})
      await unlink(outputPath).catch(() => {})
      return null
    }

  } catch (error) {
    console.warn('[extractVideoFrame] Error:', error)
    return null
  }
}

/**
 * Render PDF first page using pdfjs-dist
 * NOTE: This is a placeholder - full implementation requires server-side canvas (node-canvas)
 */
export async function renderPdfFirstPage(pdfUrl: string): Promise<string | null> {
  try {
    console.log('[renderPdfFirstPage] Rendering PDF page from:', pdfUrl.substring(0, 50))
    
    // TODO: Implement server-side PDF rendering
    // This requires node-canvas or a headless browser
    // For now, return null to fall back to generated cover
    console.warn('[renderPdfFirstPage] Server-side PDF rendering not yet implemented')
    return null
  } catch (error) {
    console.warn('[renderPdfFirstPage] Error:', error)
    return null
  }
}

