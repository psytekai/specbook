import { ipcMain, BrowserWindow } from 'electron';
import { pythonBridge, ScrapeOptions, ScrapeProgress } from '../services/PythonBridge';

/**
 * Set up IPC handlers for Python bridge operations
 */
export function setupPythonIPC(mainWindow?: BrowserWindow): void {
  /**
   * Check Python bridge availability
   */
  ipcMain.handle('python:check-availability', async () => {
    try {
      console.log('🐍 IPC: python:check-availability called');
      const isAvailable = await pythonBridge.checkAvailability();
      const status = pythonBridge.getStatus();
      
      console.log('🐍 IPC: Python bridge status:', {
        available: isAvailable,
        error: status.error,
        bridgePath: status.bridgePath
      });
      
      return {
        available: isAvailable,
        error: status.error,
        bridgePath: status.bridgePath
      };
    } catch (error) {
      console.error('🐍 IPC: Error checking Python availability:', error);
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        bridgePath: ''
      };
    }
  });

  /**
   * Scrape product using Python bridge
   */
  ipcMain.handle('python:scrape-product', async (_event, url: string, options?: ScrapeOptions) => {
    try {
      console.log('🐍 IPC: python:scrape-product called', { url, options });
      
      const result = await pythonBridge.scrapeProduct(
        url,
        options || {},
        (progress: ScrapeProgress) => {
          // Send progress updates to renderer
          console.log('🐍 IPC: Progress update:', progress);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('python:scrape-progress', progress);
          }
        }
      );
      
      console.log('🐍 IPC: Scrape result:', {
        success: result.success,
        hasData: !!result.data,
        error: result.error
      });
      
      return result;
    } catch (error) {
      console.error('🐍 IPC: Error scraping product:', error);
      return {
        success: false,
        data: null,
        metadata: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        diagnostics: []
      };
    }
  });

  /**
   * Get Python bridge status
   */
  ipcMain.handle('python:get-status', async () => {
    try {
      console.log('🐍 IPC: python:get-status called');
      const status = pythonBridge.getStatus();
      console.log('🐍 IPC: Current status:', status);
      return status;
    } catch (error) {
      console.error('🐍 IPC: Error getting status:', error);
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        bridgePath: ''
      };
    }
  });
  
  /**
   * Run Python bridge diagnostics
   */
  ipcMain.handle('python:run-diagnostics', async () => {
    try {
      console.log('🐍 IPC: python:run-diagnostics called');
      const diagnostics = await pythonBridge.runDiagnostics();
      console.log('🐍 IPC: Diagnostics result:', diagnostics);
      return diagnostics;
    } catch (error) {
      console.error('🐍 IPC: Error running diagnostics:', error);
      return {
        executable: 'unknown',
        exists: false,
        platform: process.platform,
        env: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  console.log('🐍 IPC: Python handlers registered successfully');
}