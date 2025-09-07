import React from 'react';
import { SettingsTab } from '../types';

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const tabs: Array<{ key: SettingsTab; label: string; icon: React.ReactNode }> = [
  {
    key: 'columns',
    label: 'Columns',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="6.5" y="3" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="3" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    )
  },
  {
    key: 'export',
    label: 'Export',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v8M5 7l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 12v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  }
];

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ activeTab, onTabChange }) => {
  const handleKeyDown = (e: React.KeyboardEvent, tab: SettingsTab) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTabChange(tab);
    }
    
    // Arrow key navigation
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const currentIndex = tabs.findIndex(t => t.key === activeTab);
      const nextIndex = e.key === 'ArrowLeft' 
        ? (currentIndex - 1 + tabs.length) % tabs.length
        : (currentIndex + 1) % tabs.length;
      onTabChange(tabs[nextIndex].key);
    }
  };

  return (
    <div className="settings-tabs" role="tablist" aria-label="Table settings tabs">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`settings-tab ${activeTab === tab.key ? 'active' : ''}`}
          onClick={() => onTabChange(tab.key)}
          onKeyDown={(e) => handleKeyDown(e, tab.key)}
          role="tab"
          aria-selected={activeTab === tab.key}
          aria-controls={`${tab.key}-panel`}
          tabIndex={activeTab === tab.key ? 0 : -1}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};