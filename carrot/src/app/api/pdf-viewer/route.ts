import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/pdf-viewer - Serve PDF viewer page
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const pdfUrl = url.searchParams.get('url');
  
  if (!pdfUrl) {
    return new NextResponse('PDF URL is required', { status: 400 });
  }

  // Create a simple PDF viewer HTML page
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PDF Viewer</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
        }
        .pdf-container {
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .pdf-toolbar {
          background: white;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e5e5;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pdf-toolbar button {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 14px;
        }
        .pdf-toolbar button:hover {
          background: #f9fafb;
        }
        .pdf-viewer {
          flex: 1;
          background: white;
        }
        .pdf-viewer iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        .error-message {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6b7280;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div class="pdf-container">
        <div class="pdf-toolbar">
          <button onclick="window.print()">Print</button>
          <button onclick="downloadPDF()">Download</button>
          <button onclick="toggleFullscreen()">Fullscreen</button>
          <span style="margin-left: auto; color: #6b7280; font-size: 14px;">
            PDF Viewer
          </span>
        </div>
        <div class="pdf-viewer">
          <iframe 
            src="${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1" 
            title="PDF Document"
            onerror="showError()"
          ></iframe>
        </div>
      </div>
      
      <script>
        function downloadPDF() {
          const link = document.createElement('a');
          link.href = '${pdfUrl}';
          link.download = 'document.pdf';
          link.click();
        }
        
        function toggleFullscreen() {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
        }
        
        function showError() {
          document.querySelector('.pdf-viewer').innerHTML = 
            '<div class="error-message">Unable to load PDF. Please check the URL or try downloading the file.</div>';
        }
      </script>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
