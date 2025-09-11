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
  tagId: string;
  location: string[];           // CHANGED: multi-select
  description: string;
  specificationDescription: string;
  category: string | string[];  // FLEXIBLE: can be string or array
  product_name?: string;        // NEW
  manufacturer?: string;        // NEW  
  price?: number;              // NEW
  // Asset management fields (Phase 4)
  primaryImageHash?: string;    // Content-addressable hash for primary image
  primaryThumbnailHash?: string; // Hash for thumbnail of primary image
  additionalImagesHashes?: string[]; // Array of hashes for additional images
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiError {
  message: string;
  code: string;
}

export interface FetchProductDetailsRequest {
  product_url: string;
  tag_id: string;
  product_location: string;
}

export interface FetchProductDetailsResponse {
  product_description: string;
  specification_description: string;
  category: string[];
  product_name?: string;        // NEW
  manufacturer?: string;        // NEW
  price?: number;              // NEW
  // Asset management fields (Phase 4)
  primaryImageHash?: string;    // Content-addressable hash for primary image
  primaryThumbnailHash?: string; // Hash for thumbnail of primary image
  additionalImagesHashes?: string[]; // Array of hashes for additional images
}

export interface SaveProductRequest {
  product_url: string;
  tag_id: string;
  product_location: string[];   // CHANGED: multi-select
  product_description: string;
  specification_description: string;
  category: string[];
  product_name?: string;        // NEW
  manufacturer?: string;        // NEW
  price?: number;              // NEW
  // Asset management fields (Phase 4)
  primaryImageHash?: string;    // Content-addressable hash for primary image
  primaryThumbnailHash?: string; // Hash for thumbnail of primary image
  additionalImagesHashes?: string[]; // Array of hashes for additional images
  project_id: string;
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