import React from 'react';
import { DisplaySettings as DisplaySettingsType } from '../types';

interface DisplaySettingsProps {
  settings: DisplaySettingsType;
  onChange: (settings: DisplaySettingsType) => void;
}

export const DisplaySettings: React.FC<DisplaySettingsProps> = ({
  settings,
  onChange
}) => {
  const handleDensityChange = (density: DisplaySettingsType['rowDensity']) => {
    onChange({ ...settings, rowDensity: density });
  };

  const handleImageSizeChange = (size: DisplaySettingsType['imageSize']) => {
    onChange({ ...settings, imageSize: size });
  };

  const handleToggle = (key: keyof DisplaySettingsType, value: boolean) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="settings-section" role="tabpanel" id="display-panel">
      {/* Row Density */}
      <div className="settings-group">
        <div className="settings-section-title">Row Density</div>
        <div className="settings-description">
          Choose how much vertical space each row takes up
        </div>
        
        <div className="radio-group">
          {[
            { value: 'compact', label: 'Compact', description: '40px rows' },
            { value: 'regular', label: 'Regular', description: '48px rows' },
            { value: 'comfortable', label: 'Comfortable', description: '56px rows' }
          ].map(option => (
            <label key={option.value} className={`radio-option ${settings.rowDensity === option.value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="rowDensity"
                value={option.value}
                checked={settings.rowDensity === option.value}
                onChange={() => handleDensityChange(option.value as DisplaySettingsType['rowDensity'])}
              />
              <div className="radio-content">
                <span className="radio-label">{option.label}</span>
                <span className="radio-description">{option.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Image Size */}
      <div className="settings-group">
        <div className="settings-section-title">Image Size</div>
        <div className="settings-description">
          Size of product images in the table
        </div>
        
        <div className="radio-group">
          {[
            { value: 'small', label: 'Small', description: '32px' },
            { value: 'medium', label: 'Medium', description: '48px' },
            { value: 'large', label: 'Large', description: '64px' }
          ].map(option => (
            <label key={option.value} className={`radio-option ${settings.imageSize === option.value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="imageSize"
                value={option.value}
                checked={settings.imageSize === option.value}
                onChange={() => handleImageSizeChange(option.value as DisplaySettingsType['imageSize'])}
              />
              <div className="radio-content">
                <span className="radio-label">{option.label}</span>
                <span className="radio-description">{option.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Toggle Options */}
      <div className="settings-group">
        <div className="settings-section-title">Visual Options</div>
        
        <div className="settings-row">
          <div className="settings-label">
            <span>Zebra Striping</span>
            <div className="settings-description">Alternate row background colors for easier reading</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.enableZebraStriping}
              onChange={(e) => handleToggle('enableZebraStriping', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <span>Text Wrapping</span>
            <div className="settings-description">Allow text to wrap to multiple lines in cells</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.enableTextWrapping}
              onChange={(e) => handleToggle('enableTextWrapping', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <span>Row Numbers</span>
            <div className="settings-description">Show row numbers in the first column</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.showRowNumbers}
              onChange={(e) => handleToggle('showRowNumbers', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  );
};