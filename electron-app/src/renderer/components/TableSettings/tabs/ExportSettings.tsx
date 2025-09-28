import React, { useState } from 'react';
import { ExportSettings as ExportSettingsType, ColumnConfig } from '../types';
import { 
  PDFExportConfig, 
  PDF_EXPORT_OPTIONS
} from '../../../../shared/types/exportTypes';

interface ExportSettingsProps {
  settings: ExportSettingsType;
  columns: Record<string, ColumnConfig>;
  onChange: (settings: ExportSettingsType) => void;
}

export const ExportSettings: React.FC<ExportSettingsProps> = () => {
  const [pdfConfig, setPdfConfig] = useState<Partial<PDFExportConfig>>({
    groupBy: 'category',
    sortBy: 'name',
    includeImages: true,
    pageSize: 'A4',
    orientation: 'portrait',
  });
  const [isExporting, setIsExporting] = useState(false);

  const handlePDFConfigChange = (updates: Partial<PDFExportConfig>) => {
    setPdfConfig(prev => ({ ...prev, ...updates }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // TODO: Implement PDF export functionality
      // This would typically call the electron API to export PDF
      console.log('Exporting PDF with config:', pdfConfig);
      
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // TODO: Show success message or handle result
      alert('PDF export completed successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
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
      </div>
    </div>
  );
};