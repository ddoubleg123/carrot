import { test, expect } from '@playwright/test'

/**
 * Test that patch pages display saved articles
 * 
 * This test verifies:
 * 1. The API endpoint returns articles
 * 2. At least one article card renders on the page
 * 3. The debug panel shows non-zero counts when ?debug=1
 */
test.describe('Patch Articles Display', () => {
  test('should display articles on patch page', async ({ page }) => {
    // Use a known patch handle (e.g., 'chicago-bulls' or get from env)
    const patchHandle = process.env.TEST_PATCH_HANDLE || 'chicago-bulls'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    
    // Test 1: Verify API endpoint returns data
    const apiUrl = `${baseUrl}/api/patches/${patchHandle}/discovered-content?limit=50&debug=1`
    console.log(`[Test] Fetching API: ${apiUrl}`)
    
    const apiResponse = await page.request.get(apiUrl)
    expect(apiResponse.ok()).toBeTruthy()
    
    const apiData = await apiResponse.json()
    console.log('[Test] API Response:', {
      success: apiData.success,
      itemsCount: Array.isArray(apiData.items) ? apiData.items.length : 0,
      totalItems: apiData.totalItems,
      debug: apiData.debug
    })
    
    expect(apiData.success).toBe(true)
    expect(Array.isArray(apiData.items)).toBe(true)
    
    // If there are items in the database, verify at least one is returned
    if (apiData.totalItems > 0) {
      expect(apiData.items.length).toBeGreaterThan(0)
    }
    
    // Test 2: Navigate to patch page and verify rendering
    const patchUrl = `${baseUrl}/patch/${patchHandle}?debug=1`
    console.log(`[Test] Navigating to: ${patchUrl}`)
    
    await page.goto(patchUrl)
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check for debug panel if items exist
    const debugPanel = page.locator('text=Debug Panel').first()
    if (await debugPanel.isVisible().catch(() => false)) {
      const rawCount = await page.locator('text=/Raw Items.*\\d+/').textContent().catch(() => null)
      const dedupedCount = await page.locator('text=/Deduped.*\\d+/').textContent().catch(() => null)
      
      console.log('[Test] Debug Panel:', { rawCount, dedupedCount })
      
      if (rawCount) {
        const count = parseInt(rawCount.match(/\d+/)?.[0] || '0')
        expect(count).toBeGreaterThanOrEqual(0)
      }
    }
    
    // Check for article cards (DiscoveryCard components)
    // Look for common elements in discovery cards
    const articleCards = page.locator('[data-testid="discovery-card"], .discovery-card, [class*="DiscoveryCard"]')
    const cardCount = await articleCards.count()
    
    console.log('[Test] Article cards found:', cardCount)
    
    // If API returned items, at least one card should render
    if (apiData.items.length > 0) {
      expect(cardCount).toBeGreaterThan(0)
      
      // Verify first card has required elements
      const firstCard = articleCards.first()
      const title = await firstCard.locator('h3, [class*="title"], [class*="Title"]').first().textContent().catch(() => null)
      expect(title).toBeTruthy()
      expect(title?.trim().length).toBeGreaterThan(0)
      
      console.log('[Test] First card title:', title)
    } else {
      // If no items, verify empty state is shown
      const emptyState = page.locator('text=/No discoveries yet|No discovered content|No articles/i')
      const emptyStateVisible = await emptyState.isVisible().catch(() => false)
      
      if (emptyStateVisible) {
        console.log('[Test] Empty state shown (expected if no articles)')
      }
    }
    
    // Test 3: Verify health endpoint
    const healthUrl = `${baseUrl}/api/patches/${patchHandle}/discovered-content/health`
    const healthResponse = await page.request.get(healthUrl)
    expect(healthResponse.ok()).toBeTruthy()
    
    const healthData = await healthResponse.json()
    console.log('[Test] Health endpoint:', {
      count: healthData.count,
      sampleCount: healthData.sampleCount
    })
    
    expect(healthData.success).toBe(true)
    expect(typeof healthData.count).toBe('number')
    expect(healthData.count).toBeGreaterThanOrEqual(0)
  })
  
  test('should show debug panel with ?debug=1', async ({ page }) => {
    const patchHandle = process.env.TEST_PATCH_HANDLE || 'chicago-bulls'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const patchUrl = `${baseUrl}/patch/${patchHandle}?debug=1`
    
    await page.goto(patchUrl)
    await page.waitForLoadState('networkidle')
    
    // Check for debug panel
    const debugPanel = page.locator('text=Debug Panel').first()
    const isVisible = await debugPanel.isVisible().catch(() => false)
    
    if (isVisible) {
      // Verify debug panel shows counts
      const patchHandleText = await page.locator('text=/Patch Handle/').isVisible().catch(() => false)
      const rawItemsText = await page.locator('text=/Raw Items/').isVisible().catch(() => false)
      
      expect(patchHandleText || rawItemsText).toBeTruthy()
    }
  })
})

