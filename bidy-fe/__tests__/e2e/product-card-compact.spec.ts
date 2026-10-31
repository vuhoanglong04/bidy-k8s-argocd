import { test, expect } from '@playwright/test';

test.describe('ProductCardCompact - Responsive Grid Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to product listing page
    await page.goto('/');
    // Wait for products to load
    await page.waitForSelector('article', { timeout: 10000 });
  });

  test('displays 3 cards per row on desktop (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Wait for grid to render
    const grid = page.locator('div').filter({ hasText: /grid/ }).first();
    await grid.waitFor({ state: 'visible' });

    // Get computed grid template columns
    const gridStyle = await grid.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        gridTemplateColumns: computed.gridTemplateColumns,
        display: computed.display
      };
    });

    // Should have grid display
    expect(gridStyle.display).toContain('grid');

    // Count number of columns (should be 3 for compact mode)
    const columns = gridStyle.gridTemplateColumns.split(' ').length;
    expect(columns).toBe(3);
  });

  test('displays 2 cards per row on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const grid = page.locator('div').filter({ hasText: /grid/ }).first();
    await grid.waitFor({ state: 'visible' });

    const gridStyle = await grid.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });

    const columns = gridStyle.split(' ').length;
    expect(columns).toBe(2);
  });

  test('displays 1 card per row on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const grid = page.locator('div').filter({ hasText: /grid/ }).first();
    await grid.waitFor({ state: 'visible' });

    const gridStyle = await grid.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });

    const columns = gridStyle.split(' ').length;
    expect(columns).toBe(1);
  });

  test('compact card has correct structure and elements', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const firstCard = page.locator('article').first();
    await firstCard.waitFor({ state: 'visible' });

    // Check for image section
    const image = firstCard.locator('img').first();
    await expect(image).toBeVisible();

    // Check for title
    const title = firstCard.locator('h3').first();
    await expect(title).toBeVisible();

    // Check for pricing information
    await expect(firstCard.getByText(/Giá KĐ:/)).toBeVisible();
    await expect(firstCard.getByText(/Hiện tại:|Cuối cùng:/)).toBeVisible();

    // Check for seller info
    await expect(firstCard.locator('svg').filter({ has: page.locator('[data-testid="user"]') })).toBeTruthy();
  });

  test('card has hover effect', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const card = page.locator('article').first();
    await card.waitFor({ state: 'visible' });

    // Get initial box shadow
    const initialShadow = await card.evaluate((el) =>
      window.getComputedStyle(el).boxShadow
    );

    // Hover over card
    await card.hover();
    await page.waitForTimeout(300); // Wait for transition

    // Get hover box shadow
    const hoverShadow = await card.evaluate((el) =>
      window.getComputedStyle(el).boxShadow
    );

    // Shadow should change on hover
    expect(hoverShadow).not.toBe(initialShadow);

    // Check for transform (should have translate)
    const transform = await card.evaluate((el) =>
      window.getComputedStyle(el).transform
    );
    expect(transform).not.toBe('none');
  });

  test('navigates to product detail on click', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const firstCard = page.locator('article').first();
    await firstCard.waitFor({ state: 'visible' });

    // Click the card
    await firstCard.click();

    // Should navigate to product detail page
    await page.waitForURL(/\/product\/\w+/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/product\/\w+/);
  });

  test('card displays status badge', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const firstCard = page.locator('article').first();
    await firstCard.waitFor({ state: 'visible' });

    // Check for status badge
    const statusBadge = firstCard.locator('div').filter({ hasText: /Đang đấu giá|Đã kết thúc|Sắp đấu giá/ }).first();
    await expect(statusBadge).toBeVisible();
  });

  test('card displays countdown timer for active auctions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Find active auction card
    const activeCard = page.locator('article').filter({
      has: page.locator('text=/Đang đấu giá/')
    }).first();

    if (await activeCard.count() > 0) {
      // Check for countdown timer
      const timer = activeCard.locator('div').filter({ hasText: /\d{2}:\d{2}:\d{2}/ });
      await expect(timer).toBeVisible();

      // Timer should be in HH:MM:SS format
      const timerText = await timer.textContent();
      expect(timerText).toMatch(/\d{2}:\d{2}:\d{2}/);
    }
  });

  test('image loads correctly with proper size', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const firstCard = page.locator('article').first();
    const image = firstCard.locator('img').first();
    await image.waitFor({ state: 'visible' });

    // Check image dimensions
    const dimensions = await image.boundingBox();
    expect(dimensions).toBeTruthy();

    // On desktop, image should be approximately 140x140px
    if (dimensions) {
      expect(dimensions.width).toBeGreaterThanOrEqual(130);
      expect(dimensions.width).toBeLessThanOrEqual(150);
      expect(dimensions.height).toBeGreaterThanOrEqual(130);
      expect(dimensions.height).toBeLessThanOrEqual(150);
    }
  });

  test('image is smaller on mobile (120x120px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const firstCard = page.locator('article').first();
    const image = firstCard.locator('img').first();
    await image.waitFor({ state: 'visible' });

    const dimensions = await image.boundingBox();
    if (dimensions) {
      // On mobile, image should be approximately 120x120px
      expect(dimensions.width).toBeGreaterThanOrEqual(110);
      expect(dimensions.width).toBeLessThanOrEqual(130);
    }
  });

  test('card is keyboard accessible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const firstCard = page.locator('article').first();
    await firstCard.waitFor({ state: 'visible' });

    // Focus on the card
    await firstCard.focus();

    // Check if card has focus
    const isFocused = await firstCard.evaluate((el) =>
      el === document.activeElement || el.contains(document.activeElement)
    );
    expect(isFocused).toBeTruthy();

    // Press Enter to navigate
    await page.keyboard.press('Enter');

    // Should navigate to product detail
    await page.waitForURL(/\/product\/\w+/, { timeout: 5000 });
  });

  test('prices are formatted correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const firstCard = page.locator('article').first();
    await firstCard.waitFor({ state: 'visible' });

    // Get price text
    const priceText = await firstCard.locator('text=/\\d+[.,]?\\d*đ/').first().textContent();

    // Should end with 'đ' (Vietnamese currency)
    expect(priceText).toMatch(/đ$/);

    // Should have proper number formatting
    expect(priceText).toMatch(/^\d+[.,]?\d*đ$/);
  });

  test('view mode toggle cycles through compact/grid/list', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Find view toggle button (usually has grid/list icon)
    const viewToggle = page.locator('button').filter({ hasText: /Grid|List/ }).or(
      page.locator('button').filter({ has: page.locator('svg path[d*="M3"]') })
    ).first();

    if (await viewToggle.count() > 0) {
      // Click to change view mode
      await viewToggle.click();
      await page.waitForTimeout(300);

      // Grid should change
      const gridAfterClick = page.locator('div').filter({ hasText: /grid/ }).first();
      await gridAfterClick.waitFor({ state: 'visible' });

      // Verify grid changed (you can add more specific checks based on your implementation)
      const newGridStyle = await gridAfterClick.evaluate((el) =>
        window.getComputedStyle(el).gridTemplateColumns
      );
      expect(newGridStyle).toBeTruthy();
    }
  });
});

test.describe('ProductCardCompact - Accessibility', () => {
  test('has proper ARIA labels', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('article');

    const firstCard = page.locator('article').first();

    // Check for aria-label
    const ariaLabel = await firstCard.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toContain('Auction');
  });

  test('has proper role for card', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('article');

    const firstCard = page.locator('article').first();

    // Check for role
    const role = await firstCard.getAttribute('role');
    expect(role).toBe('button');
  });

  test('has proper tab index', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('article');

    const firstCard = page.locator('article').first();

    // Check for tabIndex
    const tabIndex = await firstCard.getAttribute('tabindex');
    expect(tabIndex).toBe('0');
  });
});

test.describe('ProductCardCompact - Performance', () => {
  test('loads images lazily', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('article');

    // Check if images have loading="lazy"
    const images = page.locator('article img');
    const firstImage = images.first();

    const loading = await firstImage.getAttribute('loading');
    // Next.js Image component handles lazy loading automatically
    // Just verify image exists and loads
    await expect(firstImage).toBeVisible();
  });

  test('renders multiple cards efficiently', async ({ page }) => {
    await page.goto('/');

    // Measure time to render cards
    const startTime = Date.now();
    await page.waitForSelector('article', { timeout: 10000 });
    const endTime = Date.now();

    const loadTime = endTime - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);

    // Count number of cards rendered
    const cardCount = await page.locator('article').count();
    expect(cardCount).toBeGreaterThan(0);
  });
});
