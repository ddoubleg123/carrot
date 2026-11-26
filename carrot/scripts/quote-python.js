const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/** The live service is a Node runtime. The kit's libraries are installed beside the app. */
if (!process.env.RENDER_SERVICE_ID && process.env.RENDER !== 'true') process.exit(0)

const root = path.join(__dirname, '..', 'quote-cards')
const target = path.join(root, 'py')
const browsers = path.join(root, '.browsers')
fs.mkdirSync(target, { recursive: true })
fs.mkdirSync(browsers, { recursive: true })

function run(args, extra) {
  const result = spawnSync('python3', args, {
    stdio: 'inherit',
    env: { ...process.env, PYTHONPATH: target, PLAYWRIGHT_BROWSERS_PATH: browsers, ...extra }
  })
  if (result.status !== 0) process.exit(result.status || 1)
}

run(['-m', 'pip', 'install', '--target', target, 'numpy', 'pillow', 'opencv-python-headless', 'playwright', 'pytesseract'])
run(['-m', 'playwright', 'install', 'chromium'])
