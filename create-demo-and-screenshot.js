const puppeteer = require('puppeteer');
const path = require('path');

async function createDemoAndScreenshot() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 }
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to the electron app
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    
    // Wait for the app to load
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Click on "View Projects" to go to projects page
    await page.click('text=View Projects');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Click "Add Project" button
    await page.click('text=Add Project');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fill in project details
    await page.type('input[placeholder*="name"]', 'Demo Project');
    await page.type('textarea[placeholder*="description"]', 'Demo project to showcase the updated table design');
    
    // Submit the form
    await page.click('button[type="submit"]');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Now we should be on the project page, click "Add Product"
    await page.click('text=Add Product');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fill in product details
    await page.type('input[placeholder*="URL"]', 'https://example.com/product1');
    await page.type('input[placeholder*="name"]', 'Sample Product 1');
    await page.type('textarea[placeholder*="description"]', 'This is a sample product for demonstration');
    
    // Submit the product form
    await page.click('button[type="submit"]');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Go back to project to see the table
    await page.click('text=Back to Project');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take a screenshot of the table
    const screenshotPath = path.join(__dirname, 'demo-table-screenshot.png');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    
    console.log(`Demo table screenshot saved to: ${screenshotPath}`);
    
  } catch (error) {
    console.error('Error creating demo and taking screenshot:', error);
    
    // Take a screenshot anyway to see what's on screen
    try {
      const errorScreenshotPath = path.join(__dirname, 'error-screenshot.png');
      await page.screenshot({ 
        path: errorScreenshotPath,
        fullPage: true 
      });
      console.log(`Error screenshot saved to: ${errorScreenshotPath}`);
    } catch (screenshotError) {
      console.error('Could not take error screenshot:', screenshotError);
    }
  } finally {
    await browser.close();
  }
}

createDemoAndScreenshot();