import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TableSettingsModalProps, SettingsTab, TableSettings } from './types';
import { SettingsTabs } from './components/SettingsTabs';
import { ColumnSettings } from './tabs/ColumnSettings';
import { DisplaySettings } from './tabs/DisplaySettings';
import { DataSettings } from './tabs/DataSettings';
import { ExportSettings } from './tabs/ExportSettings';
import './TableSettingsModal.css';

export const TableSettingsModal: React.FC<TableSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onApply,
  onReset
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('columns');
  const [localSettings, setLocalSettings] = useState<TableSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Update local settings when prop changes
  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleSettingsChange = useCallback((updates: Partial<TableSettings>) => {
    setLocalSettings(prev => ({
      ...prev,
      ...updates
    }));
    setHasChanges(true);
  }, []);

  const handleApply = useCallback(() => {
    onApply(localSettings);
    setHasChanges(false);
    onClose();
  }, [localSettings, onApply, onClose]);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmed) return;
    }
    setLocalSettings(settings);
    setHasChanges(false);
    onClose();
  }, [hasChanges, settings, onClose]);

  const handleReset = useCallback(() => {
    const confirmed = window.confirm('Are you sure you want to reset all table settings to defaults?');
    if (confirmed && onReset) {
      onReset();
      setHasChanges(false);
    }
  }, [onReset]);

  if (!isOpen) return null;

  return (
    <div className="table-settings-modal" role="dialog" aria-modal="true" aria-labelledby="table-settings-title">
      <div className="table-settings-backdrop" onClick={handleCancel} />
      <div 
        className="table-settings-content" 
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="table-settings-header">
          <h2 id="table-settings-title">Table Settings</h2>
          <button
            className="table-settings-close"
            onClick={handleCancel}
            aria-label="Close settings"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="table-settings-body">
          {activeTab === 'columns' && (
            <ColumnSettings 
              columns={localSettings.columns}
              columnOrder={localSettings.columnOrder}
              onChange={(columns, columnOrder) => 
                handleSettingsChange({ columns, columnOrder })
              }
            />
          )}
          
          {activeTab === 'display' && (
            <DisplaySettings 
              settings={localSettings.display}
              onChange={(display) => handleSettingsChange({ display })}
            />
          )}
          
          {activeTab === 'data' && (
            <DataSettings 
              settings={localSettings.data}
              onChange={(data) => handleSettingsChange({ data })}
            />
          )}
          
          {activeTab === 'export' && (
            <ExportSettings 
              settings={localSettings.export}
              columns={localSettings.columns}
              onChange={(exportSettings) => 
                handleSettingsChange({ export: exportSettings })
              }
            />
          )}
        </div>

        <div className="table-settings-footer">
          <div className="footer-left">
            {onReset && (
              <button
                className="button button-ghost"
                onClick={handleReset}
              >
                Reset to Defaults
              </button>
            )}
          </div>
          <div className="footer-right">
            <button
              className="button button-secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              onClick={handleApply}
              disabled={!hasChanges}
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};