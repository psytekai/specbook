export interface PDFExportConfig {
  groupBy: 'category' | 'location';
  sortBy: 'name' | 'type' | 'manufacturer' | 'price';
  includeImages: boolean;
  includeHeaders: boolean;
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  columns: PDFColumnConfig[];
  scope: 'currentView' | 'allData';
  filters?: {
    search?: string;
    category?: string;
    location?: string;
    manufacturer?: string;
  };
}

export interface PDFColumnConfig {
  key: string;
  label: string;
  width: number;
  visible: boolean;
  essential?: boolean;
}

export interface GroupedProductData {
  groupName: string;
  products: ProductForExport[];
  totalCount: number;
}

export interface ProductForExport {
  id: string;
  productName: string;
  type?: string;
  specificationDescription?: string;
  url: string;
  tagId?: string;
  category: string[];
  location: string[];
  manufacturer?: string;
  price?: number;
  primaryImageHash?: string;
  primaryThumbnailHash?: string;
}

export interface PDFGenerationResult {
  success: boolean;
  filePath?: string;
  error?: string;
  metadata: {
    pageCount: number;
    fileSize: number;
    generationTime: number;
    productCount: number;
    groupCount: number;
  };
}

export interface PDFGenerationProgress {
  stage: 'preparing' | 'processing_images' | 'generating_pdf' | 'saving' | 'complete';
  progress: number; // 0-100
  message: string;
  currentItem?: string;
}

export interface PDFExportRequest {
  config: PDFExportConfig;
  outputPath?: string; // If not provided, will show save dialog
}

export interface PDFLayoutConfig {
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  fonts: {
    header: string;
    body: string;
    small: string;
  };
  colors: {
    primary: string;
    secondary: string;
    text: string;
    border: string;
  };
  spacing: {
    lineHeight: number;
    sectionGap: number;
    rowHeight: number;
  };
  image: {
    width: number;
    height: number;
    placeholder: string;
  };
}

export const DEFAULT_PDF_LAYOUT: PDFLayoutConfig = {
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
    rowHeight: 45,
  },
  image: {
    width: 70,
    height: 70,
    placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAiIGhlaWdodD0iNzAiIHZpZXdCb3g9IjAgMCA3MCA3MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjcwIiBoZWlnaHQ9IjcwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSAyOEMzNi45MzMgMjggMzguNSAyNi40MzMgMzguNSAyNC41QzM4LjUgMjIuNTY3IDM2LjkzMyAyMSAzNSAyMUMzMy4wNjcgMjEgMzEuNSAyMi41NjcgMzEuNSAyNC41QzMxLjUgMjYuNDMzIDMzLjA2NyAyOCAzNSAyOFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTQ5IDQ5SDIxTDI4IDM1TDM1IDQyTDQyIDI4TDQ5IDQ5WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K',
  },
};

// Export format options for the UI
export const PDF_EXPORT_OPTIONS = {
  groupBy: [
    { value: 'category' as const, label: 'Category', description: 'Group products by their categories' },
    { value: 'location' as const, label: 'Location', description: 'Group products by their locations' },
  ],
  sortBy: [
    { value: 'name' as const, label: 'Product Name', description: 'Sort alphabetically by product name' },
    { value: 'type' as const, label: 'Product Type', description: 'Sort by product type' },
    { value: 'manufacturer' as const, label: 'Manufacturer', description: 'Sort by manufacturer name' },
    { value: 'price' as const, label: 'Price', description: 'Sort by price (low to high)' },
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
