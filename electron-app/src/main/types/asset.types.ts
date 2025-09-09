/**
 * Asset Management System Type Definitions
 * Content-addressable storage using SHA-256 hashes
 */

/**
 * Result of storing an asset in the system
 */
export interface AssetResult {
  /** SHA-256 hash of the original asset */
  hash: string;
  
  /** SHA-256 hash of the generated thumbnail */
  thumbnailHash: string;
  
  /** Original filename (for reference) */
  filename?: string;
  
  /** File size in bytes */
  size: number;
  
  /** MIME type of the asset */
  mimetype: string;
  
  /** Image dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
  
  /** Timestamp when asset was stored */
  storedAt: Date;
}

/**
 * Asset metadata stored in database
 */
export interface AssetMetadata {
  /** SHA-256 hash (primary key) */
  hash: string;
  
  /** Original filename */
  originalName?: string;
  
  /** MIME type */
  mimetype: string;
  
  /** File size in bytes */
  size: number;
  
  /** Image dimensions */
  width?: number;
  height?: number;
  
  /** Reference count (how many products use this asset) */
  refCount: number;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last accessed timestamp */
  lastAccessed: Date;
}

/**
 * Options for asset storage
 */
export interface AssetStorageOptions {
  /** Generate thumbnail (default: true) */
  generateThumbnail?: boolean;
  
  /** Thumbnail dimensions */
  thumbnailSize?: {
    width: number;
    height: number;
  };
  
  /** Quality for JPEG compression (1-100) */
  quality?: number;
  
  /** Force format conversion */
  format?: 'jpeg' | 'png' | 'webp';
}

/**
 * Asset validation settings
 */
export interface AssetValidationSettings {
  /** Allowed MIME types */
  allowedTypes: string[];
  
  /** Maximum file size in bytes */
  maxFileSize: number;
  
  /** Maximum dimensions */
  maxDimensions?: {
    width: number;
    height: number;
  };
  
  /** Minimum dimensions */
  minDimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Asset cleanup options
 */
export interface AssetCleanupOptions {
  /** Remove orphaned assets with no references */
  removeOrphans?: boolean;
  
  /** Remove assets not accessed in X days */
  removeOlderThan?: number;
  
  /** Dry run - don't actually delete */
  dryRun?: boolean;
}

/**
 * Asset URL format for internal use
 */
export interface AssetURL {
  /** Protocol (asset://) */
  protocol: 'asset';
  
  /** Asset hash */
  hash: string;
  
  /** Query parameters */
  params?: {
    /** Request thumbnail version */
    thumbnail?: boolean;
    
    /** Requested size */
    size?: 'small' | 'medium' | 'large' | 'original';
  };
}

/**
 * Asset manager configuration
 */
export interface AssetManagerConfig {
  /** Project path containing assets directory */
  projectPath: string;
  
  /** Default storage options */
  defaultOptions?: AssetStorageOptions;
  
  /** Validation settings */
  validation?: AssetValidationSettings;
  
  /** Enable automatic cleanup */
  autoCleanup?: boolean;
  
  /** Cache settings */
  cache?: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };
}

/**
 * Asset import result for bulk operations
 */
export interface AssetImportResult {
  /** Successfully imported assets */
  success: AssetResult[];
  
  /** Failed imports with reasons */
  failed: Array<{
    filename: string;
    error: string;
  }>;
  
  /** Total processing time */
  duration: number;
  
  /** Deduplication count */
  duplicates: number;
}

/**
 * Asset error types
 */
export enum AssetErrorType {
  INVALID_TYPE = 'INVALID_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  DIMENSION_EXCEEDED = 'DIMENSION_EXCEEDED',
  CORRUPT_FILE = 'CORRUPT_FILE',
  STORAGE_FAILED = 'STORAGE_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

/**
 * Custom error for asset operations
 */
export class AssetError extends Error {
  constructor(
    public type: AssetErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AssetError';
  }
}