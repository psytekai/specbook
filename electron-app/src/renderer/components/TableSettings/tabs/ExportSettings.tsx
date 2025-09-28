import React, { useState, useEffect } from 'react';
import { ExportSettings as ExportSettingsType, ColumnConfig } from '../types';
import { 
  PDFExportConfig, 
  PDF_EXPORT_OPTIONS,
  PDFGenerationProgress 
} from '../../../../shared/types/exportTypes';

interface ExportSettingsProps {
  settings: ExportSettingsType;
  columns: Record<string, ColumnConfig>;
  onChange: (settings: ExportSettingsType) => void;
}

export const ExportSettings: React.FC<ExportSettingsProps> = ({
  settings,
  columns,
  onChange
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [pdfConfig, setPdfConfig] = useState<Partial<PDFExportConfig>>({
    groupBy: 'category',
    sortBy: 'name',
    includeImages: true,
    pageSize: 'A4',
    orientation: 'portrait',
  });
  const [exportProgress, setExportProgress] = useState<PDFGenerationProgress | null>(null);
  const [exportStatistics, setExportStatistics] = useState<any>(null);

  const handleFormatChange = (format: ExportSettingsType['defaultFormat']) => {
    onChange({ ...settings, defaultFormat: format });
  };

  const handleToggle = (key: keyof ExportSettingsType, value: boolean) => {
    onChange({ ...settings, [key]: value });
  };

  const handleDateFormatChange = (dateFormat: string) => {
    onChange({ ...settings, dateFormat });
  };

  // Load export statistics when PDF config changes
  useEffect(() => {
    if (settings.defaultFormat === 'pdf') {
      loadExportStatistics();
    }
  }, [pdfConfig, settings.defaultFormat]);

  // Set up progress listener
  useEffect(() => {
    if (!window.electronAPI?.onExportProgress) return;

    const cleanup = window.electronAPI.onExportProgress((data: { exportId: string; progress: PDFGenerationProgress }) => {
      setExportProgress(data.progress);
    });

    return cleanup;
  }, []);

  const loadExportStatistics = async () => {
    if (!window.electronAPI?.getExportStatistics) return;

    try {
      const fullConfig = await prepareFullPDFConfig();
      const stats = await window.electronAPI.getExportStatistics(fullConfig);
      setExportStatistics(stats);
    } catch (error) {
      console.error('Failed to load export statistics:', error);
    }
  };

  const prepareFullPDFConfig = async (): Promise<PDFExportConfig> => {
    const defaultConfig = await window.electronAPI?.getDefaultExportConfig?.() || {};
    const visibleColumns = Object.values(columns).filter(col => col.visible);
    
    
    // Ensure essential columns are included
    const essentialColumns = ['productName', 'tagId'];
    const allRequiredColumns = [...visibleColumns];
    
    // Add missing essential columns
    essentialColumns.forEach(essentialKey => {
      if (!allRequiredColumns.some(col => col.key === essentialKey)) {
        // Find the column definition from all columns
        const essentialCol = Object.values(columns).find(col => col.key === essentialKey);
        if (essentialCol) {
          allRequiredColumns.push(essentialCol);
        }
      }
    });

    // Always add a virtual 'url' column for PDF export (since URL is not a separate table column)
    const hasUrlColumn = allRequiredColumns.some(col => col.key === 'url');
    if (!hasUrlColumn) {
      allRequiredColumns.push({
        key: 'url',
        label: 'Link',
        visible: true,
        order: 999, // Put it at the end
        width: 'fixed',
        essential: true
      });
    }

    // Calculate appropriate widths based on orientation
    const isLandscape = pdfConfig.orientation === 'landscape';
    const maxTotalWidth = isLandscape ? 700 : 450; // Leave margin for page borders
    const columnCount = allRequiredColumns.length;
    const baseWidth = Math.floor(maxTotalWidth / columnCount);
    
    // Adjust widths based on column type
    const getColumnWidth = (columnKey: string): number => {
      const widthMap: Record<string, number> = {
        productName: Math.min(baseWidth * 1.5, 150),
        type: Math.min(baseWidth * 0.8, 80),
        specificationDescription: Math.min(baseWidth * 1.8, 200),
        url: Math.min(baseWidth * 0.6, 60),
        tagId: Math.min(baseWidth * 0.7, 70),
        manufacturer: Math.min(baseWidth * 1.2, 120),
        price: Math.min(baseWidth * 0.6, 60),
        category: Math.min(baseWidth * 1.0, 100),
        location: Math.min(baseWidth * 1.0, 100),
        image: 60,
      };
      return widthMap[columnKey] || baseWidth;
    };
    
    return {
      ...defaultConfig,
      ...pdfConfig,
      columns: allRequiredColumns.map(col => ({
        key: col.key,
        label: col.label,
        width: getColumnWidth(col.key),
        visible: true,
        essential: essentialColumns.includes(col.key) || col.key === 'url',
      })),
      includeHeaders: settings.includeHeaders,
      scope: 'currentView',
    };
  };

  const handleQuickExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true);
    setExportProgress(null);
    
    try {
      if (format === 'pdf') {
        await handlePDFExport();
      } else {
        // TODO: Implement CSV/Excel export
        console.log('Exporting as:', format);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate export
      }
    } catch (error) {
      console.error('Export failed:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Export failed';
      if (error instanceof Error) {
        if (error.message.includes('Configuration error')) {
          errorMessage = 'Export configuration error. Please check your column selection and page settings.';
        } else if (error.message.includes('exceeds page width')) {
          errorMessage = 'Too many columns selected. Try using landscape orientation or selecting fewer columns.';
        } else {
          errorMessage = `Export failed: ${error.message}`;
        }
      }
      
      // TODO: Replace with actual toast notification
      alert(errorMessage);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handlePDFExport = async () => {
    if (!window.electronAPI?.exportToPDF) {
      throw new Error('PDF export not available');
    }

    const fullConfig = await prepareFullPDFConfig();
    
    // Validate configuration
    const validation = await window.electronAPI.validateExportConfig?.(fullConfig);
    if (validation && !validation.valid) {
      throw new Error(`Configuration error: ${validation.errors.join(', ')}`);
    }

    const result = await window.electronAPI.exportToPDF({
      config: fullConfig,
    });

    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }

    // Show success message
    const successMessage = `PDF export completed successfully!\n` +
      `• ${result.metadata.productCount} products exported\n` +
      `• ${result.metadata.pageCount} pages\n` +
      `• File saved to: ${result.filePath}`;
    
    // TODO: Replace with actual toast notification
    alert(successMessage);
    console.log('PDF export completed:', result);
  };

  const handlePDFConfigChange = (updates: Partial<PDFExportConfig>) => {
    setPdfConfig(prev => ({ ...prev, ...updates }));
  };

  const visibleColumns = Object.values(columns).filter(col => col.visible);

  return (
    <div className="settings-section" role="tabpanel" id="export-panel">
      {/* Export Format */}
      <div className="settings-group">
        <div className="settings-section-title">Default Export Format</div>
        <div className="settings-description">
          Choose your preferred format for data exports
        </div>
        
        <div className="radio-group">
          {[
            { value: 'csv', label: 'CSV', description: 'Comma-separated values, universal format' },
            { value: 'excel', label: 'Excel', description: 'Microsoft Excel format (.xlsx)' },
            { value: 'pdf', label: 'PDF', description: 'Formatted document for printing' }
          ].map(option => (
            <label key={option.value} className={`radio-option ${settings.defaultFormat === option.value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="exportFormat"
                value={option.value}
                checked={settings.defaultFormat === option.value}
                onChange={() => handleFormatChange(option.value as ExportSettingsType['defaultFormat'])}
              />
              <div className="radio-content">
                <span className="radio-label">{option.label}</span>
                <span className="radio-description">{option.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Export Options */}
      <div className="settings-group">
        <div className="settings-section-title">Export Options</div>
        
        <div className="settings-row">
          <div className="settings-label">
            <span>Include Headers</span>
            <div className="settings-description">Add column names as the first row</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.includeHeaders}
              onChange={(e) => handleToggle('includeHeaders', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <span>Include Filter State</span>
            <div className="settings-description">Add a note about current filters to the export</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.includeFilters}
              onChange={(e) => handleToggle('includeFilters', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* PDF-Specific Options */}
      {settings.defaultFormat === 'pdf' && (
        <>
          {/* PDF Grouping and Sorting */}
          <div className="settings-group">
            <div className="settings-section-title">PDF Layout Options</div>
            <div className="settings-description">
              Configure how products are organized in the PDF
            </div>
            
            <div className="control-row">
              <div className="control-group">
                <label className="control-label">Group by:</label>
                <select
                  className="control-select"
                  value={pdfConfig.groupBy || 'category'}
                  onChange={(e) => handlePDFConfigChange({ 
                    groupBy: e.target.value as 'category' | 'location' 
                  })}
                >
                  {PDF_EXPORT_OPTIONS.groupBy.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="control-description">
                  {PDF_EXPORT_OPTIONS.groupBy.find(opt => opt.value === pdfConfig.groupBy)?.description}
                </div>
              </div>

              <div className="control-group">
                <label className="control-label">Sort by:</label>
                <select
                  className="control-select"
                  value={pdfConfig.sortBy || 'name'}
                  onChange={(e) => handlePDFConfigChange({ 
                    sortBy: e.target.value as PDFExportConfig['sortBy']
                  })}
                >
                  {PDF_EXPORT_OPTIONS.sortBy.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="control-description">
                  {PDF_EXPORT_OPTIONS.sortBy.find(opt => opt.value === pdfConfig.sortBy)?.description}
                </div>
              </div>
            </div>
          </div>

          {/* PDF Page Settings */}
          <div className="settings-group">
            <div className="settings-section-title">Page Settings</div>
            
            <div className="control-row">
              <div className="control-group">
                <label className="control-label">Page Size:</label>
                <select
                  className="control-select"
                  value={pdfConfig.pageSize || 'A4'}
                  onChange={(e) => handlePDFConfigChange({ 
                    pageSize: e.target.value as 'A4' | 'Letter'
                  })}
                >
                  {PDF_EXPORT_OPTIONS.pageSize.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <label className="control-label">Orientation:</label>
                <select
                  className="control-select"
                  value={pdfConfig.orientation || 'portrait'}
                  onChange={(e) => handlePDFConfigChange({ 
                    orientation: e.target.value as 'portrait' | 'landscape'
                  })}
                >
                  {PDF_EXPORT_OPTIONS.orientation.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PDF Content Options */}
          <div className="settings-group">
            <div className="settings-section-title">Content Options</div>
            
            <div className="settings-row">
              <div className="settings-label">
                <span>Include Product Images</span>
                <div className="settings-description">Add product thumbnails to the PDF</div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={pdfConfig.includeImages ?? true}
                  onChange={(e) => handlePDFConfigChange({ includeImages: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Column Selection Note */}
          <div className="settings-group">
            <div className="settings-section-title">Column Selection</div>
            <div className="settings-description">
              Essential columns (Product Name, Tag ID, and Link) will be automatically included in the export.
              Adjust column visibility in the Columns tab to customize your export.
            </div>
          </div>

          {/* Export Statistics */}
          {exportStatistics && (
            <div className="settings-group">
              <div className="settings-section-title">Export Preview</div>
              <div className="export-stats">
                <div className="stat-item">
                  <span className="stat-label">Products to export:</span>
                  <span className="stat-value">{exportStatistics.filteredProducts}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Groups:</span>
                  <span className="stat-value">{exportStatistics.groupCount}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Estimated pages:</span>
                  <span className="stat-value">{exportStatistics.estimatedPages}</span>
                </div>
                {exportStatistics.groups && exportStatistics.groups.length > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Group breakdown:</span>
                    <div className="group-breakdown">
                      {exportStatistics.groups.slice(0, 3).map((group: any) => (
                        <span key={group.name} className="group-item">
                          {group.name}: {group.count}
                        </span>
                      ))}
                      {exportStatistics.groups.length > 3 && (
                        <span className="group-more">+{exportStatistics.groups.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Date Format */}
      <div className="settings-group">
        <div className="settings-section-title">Date Format</div>
        <div className="settings-description">
          How dates should be formatted in exports
        </div>
        
        <div className="control-group">
          <select
            className="control-select"
            value={settings.dateFormat}
            onChange={(e) => handleDateFormatChange(e.target.value)}
          >
            <option value="YYYY-MM-DD">2024-01-15 (ISO format)</option>
            <option value="MM/DD/YYYY">01/15/2024 (US format)</option>
            <option value="DD/MM/YYYY">15/01/2024 (EU format)</option>
            <option value="DD-MMM-YYYY">15-Jan-2024 (Readable)</option>
            <option value="MMMM DD, YYYY">January 15, 2024 (Full)</option>
          </select>
        </div>
      </div>

      {/* Quick Export */}
      <div className="settings-group">
        <div className="settings-section-title">Quick Export</div>
        <div className="settings-description">
          Export current table data with one click
        </div>
        
        <div className="export-buttons">
          <button
            className="export-button csv"
            onClick={() => handleQuickExport('csv')}
            disabled={isExporting}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 12v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Export CSV
          </button>
          
          <button
            className="export-button excel"
            onClick={() => handleQuickExport('excel')}
            disabled={isExporting}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 12v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Export Excel
          </button>
          
          <button
            className="export-button pdf"
            onClick={() => handleQuickExport('pdf')}
            disabled={isExporting}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 12v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Export PDF
          </button>
        </div>
        
        {isExporting && (
          <div className="export-status">
            <div className="loading-spinner"></div>
            <div className="export-progress">
              {exportProgress ? (
                <>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${exportProgress.progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    <span className="progress-stage">{exportProgress.stage}</span>
                    <span className="progress-message">{exportProgress.message}</span>
                    {exportProgress.currentItem && (
                      <span className="progress-item">{exportProgress.currentItem}</span>
                    )}
                  </div>
                </>
              ) : (
                <span>Preparing export...</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export Summary */}
      <div className="settings-group">
        <div className="settings-section-title">Export Preview</div>
        <div className="settings-info">
          <div className="info-item">
            <span className="info-label">Columns to export:</span>
            <span className="info-value">{visibleColumns.length} columns</span>
          </div>
          <div className="info-item">
            <span className="info-label">Default format:</span>
            <span className="info-value">{settings.defaultFormat.toUpperCase()}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Include headers:</span>
            <span className="info-value">{settings.includeHeaders ? 'Yes' : 'No'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Date format:</span>
            <span className="info-value">{settings.dateFormat}</span>
          </div>
        </div>
        
        <div className="export-preview">
          <div className="preview-title">Column preview:</div>
          <div className="preview-columns">
            {visibleColumns.slice(0, 5).map(col => (
              <span key={col.key} className="preview-column">{col.label}</span>
            ))}
            {visibleColumns.length > 5 && (
              <span className="preview-more">+{visibleColumns.length - 5} more</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};