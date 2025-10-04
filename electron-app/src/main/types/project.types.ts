export interface Project {
  id: string;
  name: string;
  description?: string;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
  path?: string; // Added to track the project file path
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