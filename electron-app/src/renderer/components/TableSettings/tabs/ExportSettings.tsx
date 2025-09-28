import React, { useState } from 'react';
import { ExportSettings as ExportSettingsType, ColumnConfig } from '../types';
import { 
  PDFExportConfig, 
  PDF_EXPORT_OPTIONS,
  PDFGenerationResult
} from '../../../../shared/types/exportTypes';
import { ExportService } from '../../../services/exportService';
import { EXPORT_CONFIG, getVisibleColumns } from '../../../../shared/config/exportConfig';

interface ExportSettingsProps {
  settings: ExportSettingsType;
  columns: Record<string, ColumnConfig>;
  onChange: (settings: ExportSettingsType) => void;
}

export const ExportSettings: React.FC<ExportSettingsProps> = () => {
  const [pdfConfig, setPdfConfig] = useState<Partial<PDFExportConfig>>(EXPORT_CONFIG.defaults);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<PDFGenerationResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handlePDFConfigChange = (updates: Partial<PDFExportConfig>) => {
    setPdfConfig(prev => ({ ...prev, ...updates }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportResult(null);
    setShowResult(false);
    
    try {
      const exportService = ExportService.getInstance();
      
      // Use single source of truth for export configuration
      const exportColumns = getVisibleColumns().map(col => ({
        key: col.key,
        label: col.label,
        width: col.width,
        visible: col.visible,
        essential: col.essential,
      }));

      const fullConfig = exportService.prepareExportConfig(pdfConfig, exportColumns, true);
      
      // Call the export service (this will show the file save dialog)
      const result = await exportService.exportToPDF(fullConfig as PDFExportConfig);
      
      setExportResult(result);
      setShowResult(true);
      
    } catch (error) {
      console.error('Export failed:', error);
      setExportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Export failed. Please try again.',
        metadata: {
          pageCount: 0,
          fileSize: 0,
          generationTime: 0,
          productCount: 0,
          groupCount: 0,
        },
      });
      setShowResult(true);
    } finally {
      setIsExporting(false);
    }
  };


  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="export-settings">
      <div className="settings-section">
        <h3>PDF Export Settings</h3>
        <p className="settings-description">
          Configure PDF layout and page settings for data exports.
        </p>

        {/* PDF Layout Options */}
        <div className="form-field">
          <label className="field-label">Group by</label>
          <select
            className="field-input"
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
          <div className="field-description">
            {PDF_EXPORT_OPTIONS.groupBy.find(opt => opt.value === pdfConfig.groupBy)?.description}
          </div>
        </div>

        <div className="form-field">
          <label className="field-label">Sort by</label>
          <select
            className="field-input"
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
          <div className="field-description">
            {PDF_EXPORT_OPTIONS.sortBy.find(opt => opt.value === pdfConfig.sortBy)?.description}
          </div>
        </div>

        {/* Page Settings */}
        <div className="form-field">
          <label className="field-label">Page Size</label>
          <select
            className="field-input"
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

        <div className="form-field">
          <label className="field-label">Orientation</label>
          <select
            className="field-input"
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

        {/* Export Action */}
        <div className="export-action">
          <button
            className="button button-primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>

        {/* Export Result */}
        {showResult && exportResult && (
          <div className={`export-result ${exportResult.success ? 'success' : 'error'}`}>
            {exportResult.success ? (
              <div className="export-success">
                <div className="success-header">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4"/>
                    <circle cx="10" cy="10" r="9"/>
                  </svg>
                  <h4>Export Completed Successfully!</h4>
                </div>
                
                <div className="export-details">
                  <div className="detail-row">
                    <span className="detail-label">File:</span>
                    <span className="detail-value">{exportResult.filePath}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Products:</span>
                    <span className="detail-value">{exportResult.metadata.productCount}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Pages:</span>
                    <span className="detail-value">{exportResult.metadata.pageCount}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">File Size:</span>
                    <span className="detail-value">{formatFileSize(exportResult.metadata.fileSize)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Generation Time:</span>
                    <span className="detail-value">{formatDuration(exportResult.metadata.generationTime)}</span>
                  </div>
                </div>

              </div>
            ) : (
              <div className="export-error">
                <div className="error-header">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="10" cy="10" r="9"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <h4>Export Failed</h4>
                </div>
                <p className="error-message">{exportResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};