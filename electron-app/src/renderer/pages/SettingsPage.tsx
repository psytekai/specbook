import React from 'react';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
  return (
    <div className="page-container">
      <div className="settings-page">
        <h1>Settings</h1>
        <div className="settings-placeholder">
          <p>Settings coming soon</p>
          <p className="settings-info">
            Future settings will include:
          </p>
          <ul className="settings-list">
            <li>Theme preferences</li>
            <li>Default project settings</li>
            <li>API configuration</li>
            <li>Export/Import options</li>
            <li>Keyboard shortcuts</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;