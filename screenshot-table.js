const puppeteer = require('puppeteer');
const path = require('path');

async function takeScreenshot() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless mode
    defaultViewport: { width: 1200, height: 800 }
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to the electron app (assuming it's running on localhost:5173)
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    
    // Wait for the app to load
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Click on "View Projects" to go to projects page
    try {
      await page.click('text=View Projects');
      await page.waitForTimeout ? page.waitForTimeout(2000) : new Promise(resolve => setTimeout(resolve, 2000));
      
      // If there are projects, click on the first one to see the table
      const projectLinks = await page.$$('a[href*="/projects/"]');
      if (projectLinks.length > 0) {
        await projectLinks[0].click();
        await page.waitForTimeout ? page.waitForTimeout(3000) : new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log('No projects found, staying on projects page');
      }
    } catch (clickError) {
      console.log('Could not navigate to projects, taking screenshot of current page');
    }
    
    // Take a screenshot
    const screenshotPath = path.join(__dirname, 'updated-table-screenshot.png');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    
    console.log(`Screenshot saved to: ${screenshotPath}`);
    
  } catch (error) {
    console.error('Error taking screenshot:', error);
  } finally {
    await browser.close();
  }
}

takeScreenshot();