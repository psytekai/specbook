export interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId?: string;  // Make optional
  location: string[];  // Keep as array
  description?: string;  // Make optional
  specificationDescription?: string;  // Make optional
  category: string[];  // Change from string | string[] to just string[]
  productName: string;
  manufacturer?: string;
  price?: number;
  
  // Asset fields - ensure camelCase
  primaryImageHash?: string;
  primaryThumbnailHash?: string;
  additionalImagesHashes?: string[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiError {
  message: string;
  code: string;
}

export interface FetchProductDetailsRequest {
  productUrl: string;
  tagId: string;
  productLocation: string;
}

export interface FetchProductDetailsResponse {
  productDescription: string;
  specificationDescription: string;
  category: string[];
  productName?: string;
  manufacturer?: string;
  price?: number;
  // Asset management fields (Phase 4)
  primaryImageHash?: string;
  primaryThumbnailHash?: string;
  additionalImagesHashes?: string[];
}

export interface SaveProductRequest {
  productUrl: string;
  tagId: string;
  productLocation: string[];
  productDescription: string;
  specificationDescription: string;
  category: string[];
  productName?: string;
  manufacturer?: string;
  price?: number;
  // Asset management fields (Phase 4)
  primaryImageHash?: string;
  primaryThumbnailHash?: string;
  additionalImagesHashes?: string[];
  projectId: string;
}

// Reference Data Types
export interface Location {
  id: string;
  name: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface AddLocationRequest {
  name: string;
}

export interface AddCategoryRequest {
  name: string;
}

export type ToastType = 'error' | 'success' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Python Scraping Types
export interface ScrapeProgress {
  type: 'progress';
  stage: 'init' | 'scraping' | 'processing' | 'extraction' | 'complete';
  progress: number;
  message: string;
  timestamp: number;
}

export interface ScrapeOptions {
  method?: 'auto' | 'requests' | 'firecrawl';
  llm_model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface StructuredLogEvent {
  schema: string;
  ts: string;
  event_id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  ctx?: Record<string, any>;
}

export interface ScrapeResult {
  success: boolean;
  data: {
    image_url: string;
    type: string;
    description: string;
    model_no: string;
    product_link: string;
  } | null;
  metadata: {
    scrape_method?: string;
    processing_time?: number;
    scrape_time?: number;
    llm_model?: string;
    status_code?: number;
    html_length?: number;
    processed_length?: number;
    prompt_tokens?: number;
    execution_time?: number;
    partial_output?: string;
    [key: string]: any;
  };
  error: string | null;
  diagnostics?: StructuredLogEvent[];
}

export interface PythonStatus {
  available: boolean;
  error: string | null;
  bridgePath: string;
  activeProcesses?: number;
  maxProcesses?: number;
}