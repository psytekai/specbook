import { ipcMain, BrowserWindow } from 'electron';
import { pythonBridge } from '../services/PythonBridge';
import type { ScrapeOptions, ScrapeProgress } from '../../shared/types';
import { logger } from '../../shared/logging/Logger';

var log = logger.for('pythonHandlers');

/**
 * Set up IPC handlers for Python bridge operations
 */
export function setupPythonIPC(mainWindow?: BrowserWindow): void {
  /**
   * Check Python bridge availability
   */
  ipcMain.handle('python:check-availability', async () => {
    try {
      log.info('🐍 IPC: python:check-availability called');
      const isAvailable = await pythonBridge.checkAvailability();
      const status = pythonBridge.getStatus();
      
      log.info('🐍 IPC: Python bridge status:', {
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
      log.error('🐍 IPC: Error checking Python availability:', { error });
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
      log.info('🐍 IPC: python:scrape-product called', { url, options });
      
      const result = await pythonBridge.scrapeProduct(
        url,
        options || {},
        (progress: ScrapeProgress) => {
          // Send progress updates to renderer
          log.info('🐍 IPC: Progress update:', progress);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('python:scrape-progress', progress);
          }
        }
      );
      
      log.info('🐍 IPC: Scrape result:', {
        success: result.success,
        hasData: !!result.data,
        error: result.error,
        result: result?.data,
        metadata: result?.metadata,
      });
      
      return result;
    } catch (error) {
      log.error('🐍 IPC: Error scraping product:', { error });
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
      log.info('🐍 IPC: python:get-status called');
      const status = pythonBridge.getStatus();
      log.info('🐍 IPC: Current status:', status);
      return status;
    } catch (error) {
      log.error('🐍 IPC: Error getting status:', { error });
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        bridgePath: ''
      };
    }
  });
  
  // Diagnostics IPC removed

  log.info('🐍 IPC: Python handlers registered successfully');
}