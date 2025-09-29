export interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Product type now lives in shared/types.ts; import from there where needed

export interface ApiError {
  message: string;
  code: string;
}

export interface FetchProductDetailsRequest {
  productUrl: string;
  tagId: string;
  productLocation: string;
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

// Python Scraping Types - now imported from shared
export type {
  ScrapeProgress,
  ScrapeOptions,
  StructuredLogEvent,
  ScrapeResult,
  PythonStatus
} from '../../shared/types';