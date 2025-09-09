export interface Project {
  id: string;
  name: string;
  description?: string;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
  path?: string; // Added to track the project file path
}

export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId?: string;
  location: string[];
  image?: string;
  images: string[];
  description?: string;
  specificationDescription?: string;
  category: string[];
  product_name: string;
  manufacturer?: string;
  price?: number;
  custom_image_url?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Asset management fields (Phase 4)
  imageHash?: string;        // SHA-256 hash of primary image
  thumbnailHash?: string;    // SHA-256 hash of thumbnail
  imagesHashes?: string[];   // Array of SHA-256 hashes for additional images
}

export interface Category {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Location {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Manifest {
  version: string;
  format: string;
  created: string;
  modified: string;
  project: {
    id: string;
    name: string;
    description?: string;
    productCount: number;
  };
  assets?: {
    totalCount: number;
    totalSize: number;
    thumbnailCount: number;
    lastCleanup?: string;
  };
}

export interface ProjectFileManagerOptions {
  autoSave?: boolean;
  backupOnSave?: boolean;
}