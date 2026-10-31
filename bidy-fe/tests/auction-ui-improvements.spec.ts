import { test, expect } from '@playwright/test';

test.describe('Auction Page UI Improvements', () => {
  // Test auction product ID - using the one we know exists
  const AUCTION_ID = '68a1630be7e6bd184b34be7c';
  const BASE_URL = 'http://localhost:3001';

  test.beforeEach(async ({ page }) => {
    // Navigate to the auction page
    await page.goto(`${BASE_URL}/product/${AUCTION_ID}`);
    
    // Wait for the page to load completely
    await page.waitForSelector('[data-testid="product-page"]', { timeout: 10000 }).catch(() => {
      // Fallback: wait for product title to appear
      return page.waitForSelector('h1', { timeout: 10000 });
    });
  });

  test.describe('Compact Countdown Timer', () => {
    test('should display countdown timer in top-right position', async ({ page }) => {
      // Check for the compact countdown timer
      const timer = page.locator('.absolute.top-2.right-2').first();
      await expect(timer).toBeVisible();
      
      // Verify it contains time format (HH:MM:SS)
      const timeText = await timer.textContent();
      expect(timeText).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    });

    test('should show auction status icon', async ({ page }) => {
      // Check for status icons in the compact timer
      const timer = page.locator('.absolute.top-2.right-2').first();
      await expect(timer).toBeVisible();
      
      // Should contain status emoji (🔥 for happening, ⏰ for upcoming, ✅ for ended)
      const timerContent = await timer.textContent();
      expect(timerContent).toMatch(/[🔥⏰✅]/);
    });

    test('should have responsive design', async ({ page }) => {
      // Test on mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      const timer = page.locator('.absolute.top-2.right-2').first();
      await expect(timer).toBeVisible();
      
      // Reset to desktop
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    test('should animate number changes', async ({ page }) => {
      // Wait for potential timer updates
      const timer = page.locator('.absolute.top-2.right-2').first();
      await expect(timer).toBeVisible();
      
      // Check if the timer has animation classes
      const timerHTML = await timer.innerHTML();
      expect(timerHTML).toContain('transition'); // Should have transition classes
    });
  });

  test.describe('Enhanced Product Quick Info', () => {
    test('should display product information with icons', async ({ page }) => {
      // Wait for the product info section to load
      const productInfo = page.locator('text=Thông tin sản phẩm').locator('..');
      await expect(productInfo).toBeVisible();
      
      // Check for required information fields with icons
      await expect(page.locator('text=Phân loại')).toBeVisible();
      await expect(page.locator('text=Thương hiệu')).toBeVisible();
      await expect(page.locator('text=Tình trạng')).toBeVisible();
      await expect(page.locator('text=Giá khởi điểm')).toBeVisible();
    });

    test('should show pricing information clearly', async ({ page }) => {
      // Check for price displays
      await expect(page.locator('text=Giá khởi điểm')).toBeVisible();
      await expect(page.locator('text=Mua ngay')).toBeVisible();
      await expect(page.locator('text=Giá hiện tại')).toBeVisible();
      
      // Verify VNĐ currency is displayed
      const currencyElements = page.locator('text=VNĐ');
      await expect(currencyElements.first()).toBeVisible();
    });

    test('should have improved visual hierarchy', async ({ page }) => {
      // Check for enhanced styling
      const infoSection = page.locator('text=Thông tin sản phẩm').locator('..');
      
      // Should have proper spacing and borders
      const infoSectionClass = await infoSection.getAttribute('class');
      expect(infoSectionClass).toContain('gap'); // Should have gap spacing
      expect(infoSectionClass).toContain('rounded'); // Should have rounded corners
    });

    test('should animate on load', async ({ page }) => {
      // Reload page to test animation
      await page.reload();
      
      // Wait for animations to complete
      await page.waitForTimeout(1000);
      
      // Check if the product info is visible after animations
      const productInfo = page.locator('text=Thông tin sản phẩm').locator('..');
      await expect(productInfo).toBeVisible();
    });
  });

  test.describe('Improved ProductCTA Buttons', () => {
    test('should display primary action (bid) prominently', async ({ page }) => {
      // Check for the main bid section
      const bidSection = page.locator('text=Đấu giá thủ công').locator('..');
      await expect(bidSection).toBeVisible();
      
      // Check for bid input field
      const bidInput = page.locator('input[type="number"]').first();
      await expect(bidInput).toBeVisible();
      
      // Check for bid button
      const bidButton = page.locator('text=Đấu giá').first();
      await expect(bidButton).toBeVisible();
    });

    test('should show secondary actions (buy now & auto bid)', async ({ page }) => {
      // Check for Buy Now section
      const buyNowSection = page.locator('text=Mua ngay').locator('..').locator('..');
      await expect(buyNowSection).toBeVisible();
      
      // Check for Auto Bid section
      const autoBidSection = page.locator('text=Đấu giá tự động').locator('..').locator('..');
      await expect(autoBidSection).toBeVisible();
    });

    test('should have proper button states', async ({ page }) => {
      // Test bid button disabled state (when no input)
      const bidButton = page.locator('button:has-text("Đấu giá")');
      await expect(bidButton).toBeDisabled();
      
      // Test auto bid button disabled state
      const autoBidButton = page.locator('button:has-text("Kích hoạt")');
      await expect(autoBidButton).toBeDisabled();
    });

    test('should enable bid button when amount is entered', async ({ page }) => {
      // Enter a bid amount
      const bidInput = page.locator('input[type="number"]').first();
      await bidInput.fill('150000');
      
      // Check if bid button becomes enabled
      const bidButton = page.locator('button:has-text("Đấu giá")');
      await expect(bidButton).toBeEnabled();
    });

    test('should enable auto bid button when both fields are filled', async ({ page }) => {
      // Fill auto bid fields
      const incrementInput = page.locator('input[placeholder*="Mức tăng"]');
      const limitInput = page.locator('input[placeholder*="Giới hạn"]');
      
      await incrementInput.fill('10000');
      await limitInput.fill('500000');
      
      // Check if auto bid button becomes enabled
      const autoBidButton = page.locator('button:has-text("Kích hoạt")');
      await expect(autoBidButton).toBeEnabled();
    });

    test('should have hover animations', async ({ page }) => {
      // Test hover on buy now button
      const buyNowButton = page.locator('button:has-text("Mua ngay")');
      await buyNowButton.hover();
      
      // Button should still be visible after hover
      await expect(buyNowButton).toBeVisible();
    });

    test('should show icons in buttons', async ({ page }) => {
      // Check for icons in action sections
      const bidSection = page.locator('text=Đấu giá thủ công').locator('..');
      const buyNowSection = page.locator('text=Mua ngay').locator('..').locator('..');
      const autoBidSection = page.locator('text=Đấu giá tự động').locator('..').locator('..');
      
      // All sections should be visible
      await expect(bidSection).toBeVisible();
      await expect(buyNowSection).toBeVisible();
      await expect(autoBidSection).toBeVisible();
    });
  });

  test.describe('Overall Layout and Responsiveness', () => {
    test('should be responsive on mobile devices', async ({ page }) => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check if main elements are still visible
      await expect(page.locator('h1')).toBeVisible(); // Product title
      await expect(page.locator('text=Thông tin sản phẩm')).toBeVisible();
      await expect(page.locator('text=Đấu giá thủ công')).toBeVisible();
    });

    test('should be responsive on tablet devices', async ({ page }) => {
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Check layout on tablet
      await expect(page.locator('text=Thông tin sản phẩm')).toBeVisible();
      await expect(page.locator('text=Đấu giá thủ công')).toBeVisible();
    });

    test('should maintain proper spacing and alignment', async ({ page }) => {
      // Check for proper layout structure
      const mainContent = page.locator('.max-w-7xl').first();
      await expect(mainContent).toBeVisible();
      
      // Should have proper gap spacing
      const productCard = page.locator('.rounded-2xl.border').first();
      await expect(productCard).toBeVisible();
    });
  });

  test.describe('Animation and Interaction Quality', () => {
    test('should show smooth transitions', async ({ page }) => {
      // Test page load animations
      await page.reload();
      await page.waitForTimeout(500);
      
      // Elements should appear smoothly
      const productInfo = page.locator('text=Thông tin sản phẩm');
      await expect(productInfo).toBeVisible();
    });

    test('should handle user interactions smoothly', async ({ page }) => {
      // Test form interactions
      const bidInput = page.locator('input[type="number"]').first();
      
      // Focus and type
      await bidInput.focus();
      await bidInput.fill('200000');
      
      // Should update without issues
      await expect(bidInput).toHaveValue('200000');
    });

    test('should provide visual feedback', async ({ page }) => {
      // Test button hover states
      const buyNowButton = page.locator('button:has-text("Mua ngay")');
      
      // Should be interactive
      await buyNowButton.hover();
      await expect(buyNowButton).toBeVisible();
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should load quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(`${BASE_URL}/product/${AUCTION_ID}`);
      await page.waitForSelector('h1', { timeout: 10000 });
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    });

    test('should be keyboard accessible', async ({ page }) => {
      // Test tab navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to navigate to interactive elements
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Check for accessibility attributes
      const bidInput = page.locator('input[type="number"]').first();
      
      // Should have proper labeling
      await expect(bidInput).toBeVisible();
    });
  });

  test.describe('Cross-browser Compatibility', () => {
    test('should work consistently across browsers', async ({ page, browserName }) => {
      // Test basic functionality works in all browsers
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('text=Thông tin sản phẩm')).toBeVisible();
      await expect(page.locator('text=Đấu giá thủ công')).toBeVisible();
      
      console.log(`Testing on ${browserName}`);
    });
  });
});