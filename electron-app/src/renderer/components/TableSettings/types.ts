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
  defaultFormat: 'pdf';
  includeHeaders: boolean;
  includeFilters: boolean;
  dateFormat: string;
  lastExportConfig?: ExportConfig;
}

export interface ExportConfig {
  format: 'pdf';
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

// Import types from the main types file
import { Location, Category } from '../../types';

export interface TableSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TableSettings;
  onApply: (settings: TableSettings) => void;
  onReset?: () => void;
  // New props for locations and categories management
  locations?: Location[];
  categories?: Category[];
  onAddLocation?: (name: string) => Promise<Location>;
  onUpdateLocation?: (id: string, name: string) => Promise<Location>;
  onDeleteLocation?: (id: string) => Promise<boolean>;
  onAddCategory?: (name: string) => Promise<Category>;
  onUpdateCategory?: (id: string, name: string) => Promise<Category>;
  onDeleteCategory?: (id: string) => Promise<boolean>;
}

export type SettingsTab = 'columns' | 'export' | 'locations' | 'categories';