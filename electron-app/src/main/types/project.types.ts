import { Project } from '../../shared/types';

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
  project: Project;
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