/**
 * Create a test page showing all extracted URLs from Wikipedia
 * Run with: npx tsx scripts/create-extraction-test-page.ts
 */

import { writeFileSync } from 'fs'
import { join } from 'path'

async function createTestPage() {
  try {
    console.log('Fetching Apartheid Wikipedia page...')
    
    // Fetch the Apartheid page
    const response = await fetch('https://en.wikipedia.org/wiki/Apartheid', {
      headers: {
        'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const html = await response.text()
    
    console.log('Extracting URLs...')
    
    // Import extraction function
    const { extractAllExternalUrls } = await import('../src/lib/discovery/wikiUtils')
    
    const citations = extractAllExternalUrls(html, 'https://en.wikipedia.org/wiki/Apartheid')
    
    console.log(`Found ${citations.length} URLs`)
    
    // Separate by type
    const wikipediaUrls = citations.filter(c => c.url.includes('wikipedia.org'))
    const externalUrls = citations.filter(c => !c.url.includes('wikipedia.org'))
    
    // Group by section
    const bySection = citations.reduce((acc, cit) => {
      const section = cit.context || 'Unknown'
      if (!acc[section]) acc[section] = []
      acc[section].push(cit)
      return acc
    }, {} as Record<string, typeof citations>)
    
    // Create HTML test page
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wikipedia URL Extraction Test - Apartheid Page</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header h1 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #0066cc;
        }
        .stat-card h3 {
            margin: 0 0 5px 0;
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
        }
        .stat-card .number {
            font-size: 32px;
            font-weight: bold;
            color: #0066cc;
        }
        .section {
            background: white;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 {
            margin: 0 0 20px 0;
            color: #333;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 10px;
        }
        .url-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .url-item {
            padding: 15px;
            margin-bottom: 10px;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 4px solid #28a745;
            transition: all 0.2s;
        }
        .url-item:hover {
            background: #e9ecef;
            transform: translateX(5px);
        }
        .url-item.wikipedia {
            border-left-color: #0066cc;
        }
        .url-item.external {
            border-left-color: #ffc107;
        }
        .url-link {
            font-size: 16px;
            font-weight: 600;
            color: #0066cc;
            text-decoration: none;
            display: block;
            margin-bottom: 8px;
            word-break: break-all;
        }
        .url-link:hover {
            text-decoration: underline;
        }
        .url-meta {
            font-size: 13px;
            color: #666;
            margin-top: 8px;
        }
        .url-meta span {
            display: inline-block;
            margin-right: 15px;
            padding: 4px 8px;
            background: white;
            border-radius: 4px;
        }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            margin-left: 10px;
        }
        .badge.wikipedia {
            background: #0066cc;
            color: white;
        }
        .badge.external {
            background: #ffc107;
            color: #333;
        }
        .empty {
            color: #999;
            font-style: italic;
            padding: 20px;
            text-align: center;
        }
        .search-box {
            margin: 20px 0;
            padding: 15px;
            background: white;
            border-radius: 8px;
        }
        .search-box input {
            width: 100%;
            padding: 12px;
            font-size: 16px;
            border: 2px solid #ddd;
            border-radius: 6px;
        }
        .search-box input:focus {
            outline: none;
            border-color: #0066cc;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Wikipedia URL Extraction Test</h1>
        <p><strong>Source:</strong> <a href="https://en.wikipedia.org/wiki/Apartheid" target="_blank">Apartheid - Wikipedia</a></p>
        <p><strong>Extraction Date:</strong> ${new Date().toISOString()}</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <h3>Total URLs</h3>
            <div class="number">${citations.length}</div>
        </div>
        <div class="stat-card">
            <h3>Wikipedia URLs</h3>
            <div class="number">${wikipediaUrls.length}</div>
        </div>
        <div class="stat-card">
            <h3>External URLs</h3>
            <div class="number">${externalUrls.length}</div>
        </div>
        <div class="stat-card">
            <h3>Sections</h3>
            <div class="number">${Object.keys(bySection).length}</div>
        </div>
    </div>

    <div class="search-box">
        <input type="text" id="searchInput" placeholder="Search URLs..." onkeyup="filterUrls()">
    </div>

    ${Object.entries(bySection).map(([section, urls]) => `
        <div class="section">
            <h2>${section} <span style="font-size: 14px; color: #666; font-weight: normal;">(${urls.length} URLs)</span></h2>
            <ul class="url-list">
                ${urls.length > 0 ? urls.map(cit => {
                    const isWikipedia = cit.url.includes('wikipedia.org')
                    const isExternal = !isWikipedia
                    return `
                    <li class="url-item ${isWikipedia ? 'wikipedia' : 'external'}" data-url="${cit.url.toLowerCase()}" data-title="${(cit.title || '').toLowerCase()}">
                        <a href="${cit.url}" target="_blank" class="url-link">
                            ${cit.url}
                            <span class="badge ${isWikipedia ? 'wikipedia' : 'external'}">
                                ${isWikipedia ? 'Wikipedia' : 'External'}
                            </span>
                        </a>
                        <div class="url-meta">
                            ${cit.title ? `<span><strong>Title:</strong> ${cit.title}</span>` : ''}
                            ${cit.context && cit.context !== cit.title ? `<span><strong>Context:</strong> ${cit.context.substring(0, 150)}${cit.context.length > 150 ? '...' : ''}</span>` : ''}
                        </div>
                    </li>
                    `
                }).join('') : '<li class="empty">No URLs found in this section</li>'}
            </ul>
        </div>
    `).join('')}

    <script>
        function filterUrls() {
            const input = document.getElementById('searchInput');
            const filter = input.value.toLowerCase();
            const items = document.querySelectorAll('.url-item');
            
            items.forEach(item => {
                const url = item.getAttribute('data-url') || '';
                const title = item.getAttribute('data-title') || '';
                if (url.includes(filter) || title.includes(filter)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        }
    </script>
</body>
</html>`
    
    // Write to file
    const outputPath = join(process.cwd(), 'carrot', 'extraction-test-page.html')
    writeFileSync(outputPath, htmlContent, 'utf-8')
    
    console.log(`\n✅ Test page created: ${outputPath}`)
    console.log(`\n📊 Summary:`)
    console.log(`   Total URLs: ${citations.length}`)
    console.log(`   Wikipedia URLs: ${wikipediaUrls.length}`)
    console.log(`   External URLs: ${externalUrls.length}`)
    console.log(`   Sections: ${Object.keys(bySection).length}`)
    console.log(`\n🌐 External URLs by domain:`)
    
    // Count by domain
    const domainCounts = externalUrls.reduce((acc, cit) => {
      try {
        const domain = new URL(cit.url).hostname.replace(/^www\./, '')
        acc[domain] = (acc[domain] || 0) + 1
      } catch {
        acc['invalid'] = (acc['invalid'] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)
    
    Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([domain, count]) => {
        console.log(`   ${domain}: ${count}`)
      })
    
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error)
  }
}

createTestPage().catch(console.error)

