import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { PDFExportService } from '../services/pdfExportService';
import { ProductDataService } from '../services/productDataService';
import { ProjectState } from '../services/ProjectState';
import { 
  PDFExportRequest, 
  PDFGenerationResult, 
  PDFGenerationProgress,
  PDFExportConfig 
} from '../../shared/types/exportTypes';
import { Product } from '../../shared/types';
import { logger } from '../../shared/logging/Logger';

// Store active export operations
const activeExports = new Map<string, { service: PDFExportService; cancelled: boolean }>();

export function setupExportHandlers() {
  // Main PDF export handler
  ipcMain.handle('export:pdf', async (event, request: PDFExportRequest): Promise<PDFGenerationResult> => {
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate configuration
      const validation = ProductDataService.validateExportConfig(request.config);
      if (!validation.valid) {
        return {
          success: false,
          error: `Configuration validation failed: ${validation.errors.join(', ')}`,
          metadata: {
            pageCount: 0,
            fileSize: 0,
            generationTime: 0,
            productCount: 0,
            groupCount: 0,
          },
        };
      }

      // Get output path
      let outputPath = request.outputPath;
      if (!outputPath) {
        const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
          title: 'Save PDF Export',
          defaultPath: path.join(os.homedir(), 'Downloads', `product-export-${new Date().toISOString().split('T')[0]}.pdf`),
          filters: [
            { name: 'PDF Files', extensions: ['pdf'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (result.canceled || !result.filePath) {
          return {
            success: false,
            error: 'Export cancelled by user',
            metadata: {
              pageCount: 0,
              fileSize: 0,
              generationTime: 0,
              productCount: 0,
              groupCount: 0,
            },
          };
        }

        outputPath = result.filePath;
      }

      // Get products data (this would typically come from your database/API)
      const { products, categories, locations } = await getProductsForExport(request.config);
      
      // Create PDF service with progress callback
      const pdfService = new PDFExportService();
      activeExports.set(exportId, { service: pdfService, cancelled: false });

      pdfService.setProgressCallback((progress: PDFGenerationProgress) => {
        // Send progress updates to renderer
        event.sender.send('export:progress', { exportId, progress });
      });

      // Convert products to export format
      const exportProducts = ProductDataService.convertProductsForExport(products, categories, locations);
      
      // Filter products based on configuration
      const filteredProducts = ProductDataService.filterProducts(exportProducts, request.config);

      // Generate PDF
      const result = await pdfService.generateProductPDF(filteredProducts, request.config, outputPath);

      // Clean up
      activeExports.delete(exportId);

      return result;

    } catch (error) {
      console.error('PDF export error:', error);
      activeExports.delete(exportId);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during export',
        metadata: {
          pageCount: 0,
          fileSize: 0,
          generationTime: 0,
          productCount: 0,
          groupCount: 0,
        },
      };
    }
  });

  // Cancel export handler
  ipcMain.handle('export:cancel', async (_event, exportId: string): Promise<boolean> => {
    const exportOperation = activeExports.get(exportId);
    if (exportOperation) {
      exportOperation.cancelled = true;
      activeExports.delete(exportId);
      return true;
    }
    return false;
  });

  // Get export statistics handler
  ipcMain.handle('export:getStatistics', async (_event, config: PDFExportConfig) => {
    try {
      const { products, categories, locations } = await getProductsForExport(config);
      const exportProducts = ProductDataService.convertProductsForExport(products, categories, locations);
      return ProductDataService.getExportStatistics(exportProducts, config);
    } catch (error) {
      console.error('Error getting export statistics:', error);
      return null;
    }
  });

  // Validate export configuration handler
  ipcMain.handle('export:validateConfig', async (_event, config: PDFExportConfig) => {
    return ProductDataService.validateExportConfig(config);
  });

  // Get default export configuration handler
  ipcMain.handle('export:getDefaultConfig', async () => {
    return ProductDataService.prepareExportConfig({});
  });
}

/**
 * Get products for export based on configuration
 */
async function getProductsForExport(config: PDFExportConfig): Promise<{ products: Product[], categories: any[], locations: any[] }> {
  const log = logger.for('ExportHandlers');
  const projectState = ProjectState.getInstance();
  
  try {
    const state = projectState.getStateInfo();
    const manager = projectState.getManager();
    
    if (!state.isOpen || !manager) {
      log.warn('No project open for export');
      return { products: [], categories: [], locations: [] };
    }

    log.info('Fetching products for export', { 
      groupBy: config.groupBy, 
      scope: config.scope,
      hasFilters: !!config.filters 
    });

    // Get all products, categories, and locations from the current project
    const [products, categories, locations] = await Promise.all([
      manager.getProducts({
        category: config.filters?.category,
        location: config.filters?.location,
      }),
      manager.getCategories(),
      manager.getLocations()
    ]);

    log.info(`Retrieved ${products.length} products, ${categories.length} categories, ${locations.length} locations for export`);
    return { products, categories, locations };
    
  } catch (error) {
    log.error('Error fetching data for export:', error as Error);
    throw new Error('Failed to fetch data for export');
  }
}

/**
 * Helper function to show export completion notification
 */
export function showExportNotification(result: PDFGenerationResult, mainWindow: BrowserWindow) {
  if (result.success && result.filePath) {
    // You could show a native notification here
    mainWindow.webContents.send('export:completed', {
      success: true,
      filePath: result.filePath,
      metadata: result.metadata,
    });
  } else {
    mainWindow.webContents.send('export:completed', {
      success: false,
      error: result.error,
    });
  }
}
