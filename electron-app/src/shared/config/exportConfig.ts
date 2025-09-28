/**
 * SINGLE SOURCE OF TRUTH FOR PDF EXPORT CONFIGURATION
 * 
 * This is the ONLY place where export columns and layout should be configured.
 * All other files should import from here to ensure consistency.
 */

export interface ExportColumnDefinition {
  key: string;
  label: string;
  width: number;
  visible: boolean;
  essential: boolean;
}

// MASTER EXPORT CONFIGURATION - MODIFY ONLY HERE
export const EXPORT_CONFIG = {
  // Column definitions in exact export order
  columns: [
    { key: 'image', label: 'Image', width: 80, visible: true, essential: false },
    { key: 'productName', label: 'Product Name', width: 120, visible: true, essential: true },
    { key: 'type', label: 'Type', width: 70, visible: true, essential: false },
    { key: 'specificationDescription', label: 'Specification', width: 150, visible: true, essential: false },
    { key: 'category', label: 'Category', width: 60, visible: true, essential: false },
    { key: 'location', label: 'Location', width: 60, visible: true, essential: false },
    { key: 'tagId', label: 'Tag ID', width: 50, visible: true, essential: true },
    { key: 'url', label: 'URL', width: 40, visible: true, essential: true },
  ] as ExportColumnDefinition[],

  // Layout settings
  layout: {
    // Font sizes
    fonts: {
      title: 20,
      header: 8,
      body: 7,
      small: 6,
      footer: 8,
    },
    
    // Spacing
    spacing: {
      lineHeight: 1.2,
      sectionGap: 15,
      rowHeight: 50, // Increased to accommodate images properly
      headerHeight: 25,
    },
    
    // Image settings
    image: {
      width: 60,  // Smaller than column width to fit properly
      height: 40, // Fits within row height
      padding: 10, // Space around image
    },
    
    // Page margins
    margins: {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50,
    },
  },

  // Default PDF settings
  defaults: {
    groupBy: 'category' as const,
    sortBy: 'name' as const,
    includeImages: true,
    includeHeaders: true,
    pageSize: 'A4' as const,
    orientation: 'portrait' as const,
    scope: 'currentView' as const,
  },
} as const;

// Helper functions
export function getVisibleColumns(): ExportColumnDefinition[] {
  return EXPORT_CONFIG.columns.filter(col => col.visible);
}

export function getEssentialColumns(): ExportColumnDefinition[] {
  return EXPORT_CONFIG.columns.filter(col => col.essential);
}

export function getTotalWidth(): number {
  return getVisibleColumns().reduce((sum, col) => sum + col.width, 0);
}

export function validateConfiguration(orientation: 'portrait' | 'landscape' = 'portrait'): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const visibleColumns = getVisibleColumns();
  
  if (visibleColumns.length === 0) {
    errors.push('At least one column must be visible');
  }
  
  const totalWidth = getTotalWidth();
  const maxWidth = orientation === 'landscape' ? 1250 : 1000;
  
  if (totalWidth > maxWidth) {
    errors.push(`Total width (${totalWidth}px) exceeds page width (${maxWidth}px)`);
  }
  
  // Check essential columns
  const essentialKeys = getEssentialColumns().map(col => col.key);
  const visibleKeys = visibleColumns.map(col => col.key);
  const missingEssential = essentialKeys.filter(key => !visibleKeys.includes(key));
  
  if (missingEssential.length > 0) {
    errors.push(`Essential columns missing: ${missingEssential.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
