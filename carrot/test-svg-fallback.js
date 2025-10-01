// Test the SVG fallback generation
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="384" viewBox="0 0 640 384">
  <rect width="100%" height="100%" fill="#f0f9ff"/>
  <text x="320" y="120" font-family="Arial, sans-serif" font-size="24" fill="#0369a1" text-anchor="middle">🤖 AI Model Not Available</text>
  <text x="320" y="160" font-family="Arial, sans-serif" font-size="16" fill="#0369a1" text-anchor="middle">Stable Diffusion not installed</text>
  <text x="320" y="200" font-family="Arial, sans-serif" font-size="14" fill="#666" text-anchor="middle">Using basic image generation instead</text>
  <text x="320" y="240" font-family="Arial, sans-serif" font-size="12" fill="#999" text-anchor="middle">Set up GPU worker for full AI capabilities</text>
</svg>`

const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

console.log('SVG Length:', svg.length)
console.log('Data URL Length:', dataUrl.length)
console.log('Data URL Preview:', dataUrl.substring(0, 100) + '...')

// Test if the SVG is valid
try {
  const decoded = Buffer.from(dataUrl.split(',')[1], 'base64').toString('utf-8')
  console.log('Decoded SVG matches original:', decoded === svg)
  console.log('Decoded SVG preview:', decoded.substring(0, 200) + '...')
} catch (e) {
  console.error('Error decoding SVG:', e)
}
