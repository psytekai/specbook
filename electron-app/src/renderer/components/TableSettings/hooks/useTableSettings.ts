import { useState, useCallback, useMemo } from 'react';
import { TableSettings, ColumnConfig, ExportSettings } from '../types';

// Default column configurations
const createDefaultColumns = (): Record<string, ColumnConfig> => ({
  select: {
    key: 'select',
    label: 'Select',
    visible: true,
    order: 0,
    width: 'fixed',
    minWidth: 60,
    maxWidth: 60,
    essential: true
  },
  image: {
    key: 'image',
    label: 'Image',
    visible: true,
    order: 1,
    width: 'fixed',
    minWidth: 80,
    maxWidth: 120
  },
  productName: {
    key: 'productName',
    label: 'Product Name',
    visible: true,
    order: 2,
    width: 'auto',
    minWidth: 180,
    essential: true
  },
  type: {
    key: 'type',
    label: 'Type',
    visible: true,
    order: 3,
    width: 'auto',
    minWidth: 200
  },
  manufacturer: {
    key: 'manufacturer',
    label: 'Manufacturer',
    visible: true,
    order: 4,
    width: 'auto',
    minWidth: 150
  },
  price: {
    key: 'price',
    label: 'Price',
    visible: true,
    order: 5,
    width: 'fixed',
    minWidth: 100,
    maxWidth: 120
  },
  category: {
    key: 'category',
    label: 'Category',
    visible: true,
    order: 6,
    width: 'auto',
    minWidth: 120
  },
  location: {
    key: 'location',
    label: 'Location',
    visible: true,
    order: 7,
    width: 'auto',
    minWidth: 120
  },
  tagId: {
    key: 'tagId',
    label: 'Tag ID',
    visible: true,
    order: 8,
    width: 'fixed',
    minWidth: 100,
    maxWidth: 120
  },
  actions: {
    key: 'actions',
    label: 'Actions',
    visible: true,
    order: 9,
    width: 'fixed',
    minWidth: 120,
    maxWidth: 160,
    essential: true
  }
});



const createDefaultExportSettings = (): ExportSettings => ({
  defaultFormat: 'csv',
  includeHeaders: true,
  includeFilters: true,
  dateFormat: 'YYYY-MM-DD'
});

const createDefaultSettings = (): TableSettings => ({
  columns: createDefaultColumns(),
  columnOrder: Object.keys(createDefaultColumns()),
  export: createDefaultExportSettings()
});

const STORAGE_KEY_PREFIX = 'tableSettings_';

interface UseTableSettingsProps {
  projectId: string;
  initialSettings?: Partial<TableSettings>;
}

export const useTableSettings = ({ projectId, initialSettings }: UseTableSettingsProps) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${projectId}`;

  // Load settings from localStorage with validation
  const loadStoredSettings = useCallback((): TableSettings => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return createDefaultSettings();

      const parsed = JSON.parse(stored);
      const defaults = createDefaultSettings();

      // Merge with defaults to ensure all properties exist
      return {
        columns: { ...defaults.columns, ...parsed.columns },
        columnOrder: parsed.columnOrder || defaults.columnOrder,
        export: { ...defaults.export, ...parsed.export },
        savedPresets: parsed.savedPresets || [],
        activePresetId: parsed.activePresetId
      };
    } catch (error) {
      console.warn('Failed to load table settings:', error);
      return createDefaultSettings();
    }
  }, [storageKey]);

  const [settings, setSettings] = useState<TableSettings>(() => {
    const storedSettings = loadStoredSettings();
    return initialSettings ? { ...storedSettings, ...initialSettings } : storedSettings;
  });

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: TableSettings) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newSettings));
    } catch (error) {
      console.warn('Failed to save table settings:', error);
    }
  }, [storageKey]);

  // Update settings with automatic persistence
  const updateSettings = useCallback((updates: Partial<TableSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveSettings(newSettings);
      return newSettings;
    });
  }, [saveSettings]);

  // Reset to default settings
  const resetSettings = useCallback(() => {
    const defaultSettings = createDefaultSettings();
    setSettings(defaultSettings);
    saveSettings(defaultSettings);
  }, [saveSettings]);

  // Column-specific operations
  const updateColumnVisibility = useCallback((columnKey: string, visible: boolean) => {
    updateSettings({
      columns: {
        ...settings.columns,
        [columnKey]: {
          ...settings.columns[columnKey],
          visible
        }
      }
    });
  }, [settings.columns, updateSettings]);

  // Get visible columns
  const visibleColumns = useMemo(() => {
    return Object.entries(settings.columns)
      .filter(([_, config]) => config.visible)
      .map(([key, _]) => key);
  }, [settings.columns]);

  // Get visible columns count (currently unused but may be needed for future features)
  // const visibleColumnsCount = useMemo(() => visibleColumns.length, [visibleColumns]);

  const updateColumnOrder = useCallback((newOrder: string[]) => {
    // Validate that all columns are included
    const currentColumns = Object.keys(settings.columns);
    const validOrder = newOrder.filter(key => currentColumns.includes(key));
    
    // Add any missing columns at the end
    const missingColumns = currentColumns.filter(key => !validOrder.includes(key));
    const completeOrder = [...validOrder, ...missingColumns];

    updateSettings({ columnOrder: completeOrder });
  }, [settings.columns, updateSettings]);

  // Computed values
  const orderedColumns = useMemo(() => {
    return settings.columnOrder
      .map(key => settings.columns[key])
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);
  }, [settings.columns, settings.columnOrder]);

  // Convert settings to legacy format for compatibility
  const toLegacyFormat = useCallback(() => {
    const visibleColumnsMap = Object.keys(settings.columns).reduce((acc, key) => {
      acc[key] = settings.columns[key].visible;
      return acc;
    }, {} as Record<string, boolean>);

    return {
      viewMode: 'list' as const,
      groupBy: 'none' as const,
      sortBy: 'name' as const,
      visibleColumns: visibleColumnsMap,
      filters: {
        search: '',
        category: '',
        location: '',
        manufacturer: ''
      }
    };
  }, [settings]);

  return {
    settings,
    updateSettings,
    resetSettings,
    updateColumnVisibility,
    updateColumnOrder,
    visibleColumns,
    orderedColumns,
    toLegacyFormat,
    
    // Convenience getters
    exportSettings: settings.export,
    
    // Preset management (for future implementation)
    savedPresets: settings.savedPresets || [],
    activePresetId: settings.activePresetId
  };
};