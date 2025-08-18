import React from 'react';
import { DataSettings as DataSettingsType } from '../types';

interface DataSettingsProps {
  settings: DataSettingsType;
  onChange: (settings: DataSettingsType) => void;
}

export const DataSettings: React.FC<DataSettingsProps> = ({
  settings,
  onChange
}) => {
  const handleItemsPerPageChange = (itemsPerPage: DataSettingsType['itemsPerPage']) => {
    onChange({ ...settings, itemsPerPage });
  };

  const handleSortChange = (column: string, direction: 'asc' | 'desc') => {
    onChange({
      ...settings,
      defaultSort: { column, direction }
    });
  };

  const handleAutoRefreshToggle = (enabled: boolean) => {
    onChange({
      ...settings,
      autoRefresh: { ...settings.autoRefresh, enabled }
    });
  };

  const handleIntervalChange = (interval: number) => {
    onChange({
      ...settings,
      autoRefresh: { ...settings.autoRefresh, interval }
    });
  };

  return (
    <div className="settings-section" role="tabpanel" id="data-panel">
      {/* Pagination */}
      <div className="settings-group">
        <div className="settings-section-title">Pagination</div>
        <div className="settings-description">
          Number of items to display per page
        </div>
        
        <div className="radio-group">
          {[25, 50, 100, 200].map(count => (
            <label key={count} className={`radio-option ${settings.itemsPerPage === count ? 'selected' : ''}`}>
              <input
                type="radio"
                name="itemsPerPage"
                value={count}
                checked={settings.itemsPerPage === count}
                onChange={() => handleItemsPerPageChange(count as DataSettingsType['itemsPerPage'])}
              />
              <div className="radio-content">
                <span className="radio-label">{count} items</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Default Sort */}
      <div className="settings-group">
        <div className="settings-section-title">Default Sort</div>
        <div className="settings-description">
          How to sort the table when it first loads
        </div>
        
        <div className="sort-controls">
          <div className="control-group">
            <label className="control-label">Sort by:</label>
            <select
              className="control-select"
              value={settings.defaultSort.column}
              onChange={(e) => handleSortChange(e.target.value, settings.defaultSort.direction)}
            >
              <option value="date">Date Added</option>
              <option value="name">Product Name</option>
              <option value="manufacturer">Manufacturer</option>
              <option value="price">Price</option>
              <option value="category">Category</option>
              <option value="location">Location</option>
            </select>
          </div>
          
          <div className="control-group">
            <label className="control-label">Direction:</label>
            <div className="radio-group inline">
              <label className={`radio-option ${settings.defaultSort.direction === 'asc' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="sortDirection"
                  value="asc"
                  checked={settings.defaultSort.direction === 'asc'}
                  onChange={() => handleSortChange(settings.defaultSort.column, 'asc')}
                />
                <div className="radio-content">
                  <span className="radio-label">Ascending</span>
                </div>
              </label>
              <label className={`radio-option ${settings.defaultSort.direction === 'desc' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="sortDirection"
                  value="desc"
                  checked={settings.defaultSort.direction === 'desc'}
                  onChange={() => handleSortChange(settings.defaultSort.column, 'desc')}
                />
                <div className="radio-content">
                  <span className="radio-label">Descending</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Auto Refresh */}
      <div className="settings-group">
        <div className="settings-section-title">Auto Refresh</div>
        
        <div className="settings-row">
          <div className="settings-label">
            <span>Enable Auto Refresh</span>
            <div className="settings-description">Automatically refresh table data at regular intervals</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.autoRefresh.enabled}
              onChange={(e) => handleAutoRefreshToggle(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {settings.autoRefresh.enabled && (
          <div className="settings-row">
            <div className="settings-label">
              <span>Refresh Interval</span>
              <div className="settings-description">How often to refresh the data (in seconds)</div>
            </div>
            <div className="control-group">
              <select
                className="control-select"
                value={settings.autoRefresh.interval}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
              >
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Data Summary */}
      <div className="settings-group">
        <div className="settings-section-title">Current Settings Summary</div>
        <div className="settings-info">
          <div className="info-item">
            <span className="info-label">Items per page:</span>
            <span className="info-value">{settings.itemsPerPage}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Default sort:</span>
            <span className="info-value">
              {settings.defaultSort.column} ({settings.defaultSort.direction})
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Auto refresh:</span>
            <span className="info-value">
              {settings.autoRefresh.enabled 
                ? `Every ${settings.autoRefresh.interval}s` 
                : 'Disabled'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};