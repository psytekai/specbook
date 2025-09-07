import React, { useState } from 'react';
import { ExportSettings as ExportSettingsType, ColumnConfig } from '../types';

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

  const handleFormatChange = (format: ExportSettingsType['defaultFormat']) => {
    onChange({ ...settings, defaultFormat: format });
  };

  const handleToggle = (key: keyof ExportSettingsType, value: boolean) => {
    onChange({ ...settings, [key]: value });
  };

  const handleDateFormatChange = (dateFormat: string) => {
    onChange({ ...settings, dateFormat });
  };

  const handleQuickExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true);
    try {
      // TODO: Implement actual export functionality
      console.log('Exporting as:', format);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate export
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
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
            <span>Preparing export...</span>
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