export interface PDFExportConfig {
  groupBy: 'category' | 'location';
  sortBy: 'tagId'; // We should only and always sort by tag ids
  includeImages: boolean;
  includeHeaders: boolean;
  pageSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  columns: PDFColumnConfig[];
  scope: 'currentView' | 'allData';
  issuanceName?: string; // Optional issuance name for cover page
  groupPageBreaks?: boolean; // Start each group on a new page
  showFullUrl?: boolean; // Show full URL instead of "Link" text
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
}

export interface GroupedProductData {
  groupName: string;
  products: ProductForExport[];
  totalCount: number;
}

export interface ProductForExport {
  id: string;
  primaryImageHash?: string;
  primaryThumbnailHash?: string;
  tagId?: string;
  type?: string;
  manufacturer?: string;
  specificationDescription?: string;
  modelNo?: string;
  category: string[];
  location: string[];
  url: string;
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
    default: string;
  };
  spacing: {
    lineHeight: number;
    sectionGap: number;
    rowHeight: number;
  };
}

