import { PDFLayoutConfig } from '../types/exportTypes';

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
}

const ROW_HEIGHT = 60;

// MASTER EXPORT CONFIGURATION - MODIFY ONLY HERE
export const EXPORT_CONFIG = {
  // Column definitions in exact export order
  columns: [
    { key: 'image', label: 'Image', width: 140 },
    { key: 'tagId', label: 'Tag', width: 40 },
    { key: 'type', label: 'Type', width: 65 },
    { key: 'manufacturer', label: 'Manufacturer', width: 80 },
    { key: 'specificationDescription', label: 'Description', width: 125 },
    { key: 'modelNo', label: 'Model No', width: 60 }, // TODO: implement model no
    { key: 'category', label: 'Category', width: 55 },
    { key: 'location', label: 'Location', width: 55 },
    { key: 'url', label: 'URL', width: 35 },
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
      rowHeight: ROW_HEIGHT, // Increased to accommodate images properly
      headerHeight: 25,
    },
    
    // Image settings
    image: {
      maxWidth: 110,  // Smaller than column width to fit properly
      maxHeight: ROW_HEIGHT, // Fits within row height
      padding: 10, // Space around image
      align: 'center',
      valign: 'center',
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
    sortBy: 'tagId' as const,
    includeImages: true,
    includeHeaders: true,
    pageSize: 'Letter' as const,
    orientation: 'portrait' as const,
    scope: 'currentView' as const,
  },
} as const;

// Filter out the column that matches the groupBy field to avoid redundancy
export function getColumnsForGroupBy(groupBy: 'category' | 'location'): ExportColumnDefinition[] {
  return EXPORT_CONFIG.columns.filter(col => {
    if (groupBy === 'category' && col.key === 'category') {
      return false; // Hide category column when grouping by category
    }
    if (groupBy === 'location' && col.key === 'location') {
      return false; // Hide location column when grouping by location
    }
    return true;
  });
}

export function getTotalWidth(groupBy?: 'category' | 'location'): number {
  const columns = groupBy ? getColumnsForGroupBy(groupBy) : EXPORT_CONFIG.columns;
  return columns.reduce((sum, col) => sum + col.width, 0);
}

export function validateConfiguration(
  orientation: 'portrait' | 'landscape' = 'portrait',
  groupBy?: 'category' | 'location'
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const columnsToCheck = groupBy ? getColumnsForGroupBy(groupBy) :EXPORT_CONFIG.columns;
  
  if (columnsToCheck.length === 0) {
    errors.push('At least one column must be visible');
  }
  
  const totalWidth = getTotalWidth(groupBy);
  const maxWidth = orientation === 'landscape' ? 1250 : 1000;
  
  if (totalWidth > maxWidth) {
    errors.push(`Total width (${totalWidth}px) exceeds page width (${maxWidth}px)`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}


// TODO: Conslidate to use EXPORT_CONFIG.layout, currently using a mix of both
export const DEFAULT_PDF_LAYOUT: PDFLayoutConfig = {
  // units are in points, 1 point = 1/72 inch
  margins: {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50,
  },
  fonts: {
    header: 'Helvetica-Bold',
    body: 'Helvetica',
    small: 'Helvetica',
  },
  colors: {
    primary: '#2563eb',
    secondary: '#64748b',
    text: '#1e293b',
    border: '#e2e8f0',
  },
  spacing: {
    lineHeight: 1.2,
    sectionGap: 15,
    rowHeight: ROW_HEIGHT,
  }
};

// Export format options for the UI
export const PDF_EXPORT_OPTIONS = {
  groupBy: [
    { value: 'category' as const, label: 'Category', description: 'Group products by their categories' },
    { value: 'location' as const, label: 'Location', description: 'Group products by their locations' },
  ],
  sortBy: [ // We should only and always sort by tag id
    { value: 'tagId' as const, label: 'Tag ID', description: 'Sort alphabetically by tag id' },
  ], 
  pageSize: [
    { value: 'A4' as const, label: 'A4 (210 × 297 mm)', description: 'Standard international paper size' },
    { value: 'Letter' as const, label: 'Letter (8.5 × 11 in)', description: 'Standard US paper size' },
  ],
  orientation: [
    { value: 'portrait' as const, label: 'Portrait', description: 'Vertical orientation' },
    { value: 'landscape' as const, label: 'Landscape', description: 'Horizontal orientation' },
  ],
} as const;