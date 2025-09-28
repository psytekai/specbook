import { 
  PDFExportConfig, 
  PDFExportRequest, 
  PDFGenerationResult,
  PDFGenerationProgress 
} from '../../../shared/types/exportTypes';

export class ExportService {
  private static instance: ExportService;
  private progressCallbacks: Set<(progress: PDFGenerationProgress) => void> = new Set();
  private completionCallbacks: Set<(result: PDFGenerationResult) => void> = new Set();

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }

  private setupEventListeners() {
    if (!window.electronAPI) return;

    // Set up progress listener
    window.electronAPI.onExportProgress?.((data: { exportId: string; progress: PDFGenerationProgress }) => {
      this.progressCallbacks.forEach(callback => callback(data.progress));
    });

    // Set up completion listener
    window.electronAPI.onExportCompleted?.((result: PDFGenerationResult) => {
      this.completionCallbacks.forEach(callback => callback(result));
    });
  }

  /**
   * Export products to PDF
   */
  async exportToPDF(config: PDFExportConfig, outputPath?: string): Promise<PDFGenerationResult> {
    if (!window.electronAPI?.exportToPDF) {
      throw new Error('PDF export functionality is not available');
    }

    try {
      // Validate configuration first
      const validation = await this.validateExportConfig(config);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      const request: PDFExportRequest = {
        config,
        outputPath,
      };

      const result = await window.electronAPI.exportToPDF(request);
      
      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }

      return result;
    } catch (error) {
      console.error('PDF export failed:', error);
      throw error;
    }
  }

  /**
   * Get export statistics for preview
   */
  async getExportStatistics(config: PDFExportConfig) {
    if (!window.electronAPI?.getExportStatistics) {
      return null;
    }

    try {
      return await window.electronAPI.getExportStatistics(config);
    } catch (error) {
      console.error('Failed to get export statistics:', error);
      return null;
    }
  }

  /**
   * Validate export configuration
   */
  async validateExportConfig(config: PDFExportConfig) {
    if (!window.electronAPI?.validateExportConfig) {
      return { valid: true, errors: [] };
    }

    try {
      return await window.electronAPI.validateExportConfig(config);
    } catch (error) {
      console.error('Failed to validate export config:', error);
      return { valid: false, errors: ['Validation service unavailable'] };
    }
  }

  /**
   * Get default export configuration
   */
  async getDefaultExportConfig(): Promise<PDFExportConfig | null> {
    if (!window.electronAPI?.getDefaultExportConfig) {
      return null;
    }

    try {
      return await window.electronAPI.getDefaultExportConfig();
    } catch (error) {
      console.error('Failed to get default export config:', error);
      return null;
    }
  }

  /**
   * Cancel an ongoing export
   */
  async cancelExport(exportId: string): Promise<boolean> {
    if (!window.electronAPI?.cancelExport) {
      return false;
    }

    try {
      return await window.electronAPI.cancelExport(exportId);
    } catch (error) {
      console.error('Failed to cancel export:', error);
      return false;
    }
  }

  /**
   * Subscribe to export progress updates
   */
  onProgress(callback: (progress: PDFGenerationProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    
    // Return cleanup function
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to export completion events
   */
  onCompletion(callback: (result: PDFGenerationResult) => void): () => void {
    this.completionCallbacks.add(callback);
    
    // Return cleanup function
    return () => {
      this.completionCallbacks.delete(callback);
    };
  }

  /**
   * Prepare export configuration with current table settings
   */
  prepareExportConfig(
    baseConfig: Partial<PDFExportConfig>,
    visibleColumns: Array<{ key: string; label: string; visible: boolean }>,
    includeHeaders: boolean = true
  ): Partial<PDFExportConfig> {
    const columns = visibleColumns
      .filter(col => col.visible)
      .map(col => ({
        key: col.key,
        label: col.label,
        width: this.getColumnWidth(col.key),
        visible: true,
        essential: this.isEssentialColumn(col.key),
      }));

    return {
      groupBy: 'category',
      sortBy: 'name',
      includeImages: true,
      includeHeaders,
      pageSize: 'A4',
      orientation: 'portrait',
      scope: 'currentView',
      ...baseConfig,
      columns,
    };
  }

  /**
   * Get appropriate column width based on column type
   */
  private getColumnWidth(columnKey: string): number {
    const widthMap: Record<string, number> = {
      image: 70,
      productName: 200,
      type: 100,
      specificationDescription: 250,
      url: 60,
      tagId: 80,
      manufacturer: 120,
      price: 80,
      category: 120,
      location: 120,
    };

    return widthMap[columnKey] || 100;
  }

  /**
   * Check if a column is essential (cannot be hidden)
   */
  private isEssentialColumn(columnKey: string): boolean {
    const essentialColumns = ['productName', 'url', 'tagId'];
    return essentialColumns.includes(columnKey);
  }

  /**
   * Format export result for user display
   */
  formatExportResult(result: PDFGenerationResult): string {
    if (!result.success) {
      return `Export failed: ${result.error}`;
    }

    const { metadata } = result;
    const sizeInMB = (metadata.fileSize / (1024 * 1024)).toFixed(2);
    const timeInSeconds = (metadata.generationTime / 1000).toFixed(1);

    return `Export completed successfully!\n` +
           `• ${metadata.productCount} products exported\n` +
           `• ${metadata.groupCount} groups\n` +
           `• ${metadata.pageCount} pages\n` +
           `• File size: ${sizeInMB} MB\n` +
           `• Generation time: ${timeInSeconds}s`;
  }

  /**
   * Show export result notification
   */
  showExportNotification(result: PDFGenerationResult) {
    // This would integrate with your toast/notification system
    const message = this.formatExportResult(result);
    
    if (result.success) {
      console.log('✅ Export Success:', message);
      // TODO: Show success toast
    } else {
      console.error('❌ Export Failed:', message);
      // TODO: Show error toast
    }
  }
}
