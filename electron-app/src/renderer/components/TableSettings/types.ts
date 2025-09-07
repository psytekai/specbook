export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  width?: 'auto' | 'fixed';
  minWidth?: number;
  maxWidth?: number;
  essential?: boolean; // Cannot be hidden
}

export interface ExportSettings {
  defaultFormat: 'csv' | 'excel' | 'pdf';
  includeHeaders: boolean;
  includeFilters: boolean;
  dateFormat: string;
  lastExportConfig?: ExportConfig;
}

export interface ExportConfig {
  format: 'csv' | 'excel' | 'pdf';
  columns: string[];
  includeHeaders: boolean;
  includeFilters: boolean;
  scope: 'currentView' | 'allData';
}

export interface TablePreset {
  id: string;
  name: string;
  description?: string;
  settings: Partial<TableSettings>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TableSettings {
  // Column management
  columns: Record<string, ColumnConfig>;
  columnOrder: string[];
  
  // Export preferences
  export: ExportSettings;
  
  // Saved presets
  savedPresets?: TablePreset[];
  activePresetId?: string;
}

export interface TableSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TableSettings;
  onApply: (settings: TableSettings) => void;
  onReset?: () => void;
}

export type SettingsTab = 'columns' | 'export';