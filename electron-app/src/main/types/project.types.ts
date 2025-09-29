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
  tagId?: string;  // Optional to match DB
  location: string[];  // Always array
  type?: string;  // Optional to match DB
  specificationDescription?: string;  // Optional to match DB
  category: string[];  // Always array, never string
  productName: string;
  manufacturer?: string;
  price?: number;
  
  // Asset management fields - camelCase
  primaryImageHash?: string;
  primaryThumbnailHash?: string;
  additionalImagesHashes?: string[];  // Optional array
  
  createdAt: Date;
  updatedAt: Date;
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