import React from 'react';
import { ColumnConfig } from '../types';

interface ColumnSettingsProps {
  columns: Record<string, ColumnConfig>;
  columnOrder: string[];
  onChange: (columns: Record<string, ColumnConfig>, columnOrder: string[]) => void;
}

export const ColumnSettings: React.FC<ColumnSettingsProps> = ({
  columns,
  columnOrder,
  onChange
}) => {
  const handleVisibilityChange = (columnKey: string, visible: boolean) => {
    const updatedColumns = {
      ...columns,
      [columnKey]: {
        ...columns[columnKey],
        visible
      }
    };
    onChange(updatedColumns, columnOrder);
  };

  const visibleCount = Object.values(columns).filter(col => col.visible).length;

  return (
    <div className="settings-section" role="tabpanel" id="columns-panel">
      <div className="settings-section-title">
        Column Visibility
        <span className="settings-badge">{visibleCount} of {Object.keys(columns).length} visible</span>
      </div>
      
      <div className="settings-description">
        Choose which columns to show in the table. Essential columns cannot be hidden.
      </div>

      <div className="column-list">
        {columnOrder.map(columnKey => {
          const column = columns[columnKey];
          if (!column) return null;

          return (
            <div key={columnKey} className="column-item">
              <label className="column-label-container">
                <input
                  type="checkbox"
                  className="column-checkbox"
                  checked={column.visible}
                  onChange={(e) => handleVisibilityChange(columnKey, e.target.checked)}
                  disabled={column.essential}
                />
                <span className="column-label">{column.label}</span>
                {column.essential && (
                  <span className="column-badge">Essential</span>
                )}
              </label>
            </div>
          );
        })}
      </div>

      <div className="settings-section" style={{ marginTop: '2rem' }}>
        <div className="settings-section-title">Column Information</div>
        <div className="settings-info">
          <div className="info-item">
            <span className="info-label">Total Columns:</span>
            <span className="info-value">{Object.keys(columns).length}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Visible Columns:</span>
            <span className="info-value">{visibleCount}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Hidden Columns:</span>
            <span className="info-value">{Object.keys(columns).length - visibleCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};