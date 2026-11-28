import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else ''
dest = Path(sys.argv[2]) if len(sys.argv) > 2 else None
if not dest or not (url.startswith('https://') or url.startswith('http://')):
    print('fail')
    sys.exit(2)

saved = {}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', headless=True)
    try:
        page = browser.new_page()
        page.goto(url, wait_until='commit', timeout=40000)
        page.wait_for_timeout(8000)
        response = page.context.request.get(url, timeout=40000)
        data = response.body()
        kind = (response.headers.get('content-type') or '').split(';')[0].strip().lower()
        if response.status == 200 and kind == 'application/pdf' and data.startswith(b'%PDF-') and 100 < len(data) <= 20_000_000:
            saved['data'] = data
    finally:
        browser.close()

if 'data' not in saved:
    print('fail')
    sys.exit(1)

dest.parent.mkdir(parents=True, exist_ok=True)
partial = dest.with_suffix('.pdf.part')
partial.write_bytes(saved['data'])
partial.replace(dest)
print('ok', len(saved['data']))
