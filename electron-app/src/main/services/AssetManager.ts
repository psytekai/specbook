/**
 * AssetManager - Content-addressable storage system for images
 * Handles image storage, thumbnail generation, and deduplication
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';
import Database from 'better-sqlite3';
import type {
  AssetResult,
  AssetMetadata,
  AssetStorageOptions,
  AssetValidationSettings,
  AssetCleanupOptions,
  AssetImportResult,
  AssetManagerConfig
} from '../types/asset.types';
import { AssetError, AssetErrorType } from '../types/asset.types';

// Default configuration
const DEFAULT_THUMBNAIL_SIZE = { width: 200, height: 200 };
const DEFAULT_QUALITY = 85;
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif'
];

export class AssetManager {
  private assetsPath: string;
  private thumbnailsPath: string;
  private db: Database.Database | null = null;
  private config: AssetManagerConfig;
  private validation: AssetValidationSettings;

  constructor(projectPath: string, db?: Database.Database, config?: Partial<AssetManagerConfig>) {
    this.assetsPath = path.join(projectPath, 'assets');
    this.thumbnailsPath = path.join(projectPath, 'assets', 'thumbnails');
    this.db = db || null;
    
    // Merge config with defaults
    this.config = {
      projectPath,
      defaultOptions: {
        generateThumbnail: true,
        thumbnailSize: DEFAULT_THUMBNAIL_SIZE,
        quality: DEFAULT_QUALITY,
        ...config?.defaultOptions
      },
      validation: {
        allowedTypes: DEFAULT_ALLOWED_TYPES,
        maxFileSize: DEFAULT_MAX_FILE_SIZE,
        ...config?.validation
      },
      autoCleanup: config?.autoCleanup ?? false,
      cache: config?.cache
    };
    
    this.validation = this.config.validation!;
  }

  /**
   * Set database connection
   */
  setDatabase(db: Database.Database): void {
    this.db = db;
  }

  /**
   * Store an asset with content-addressable storage
   */
  async storeAsset(
    fileData: Buffer,
    filename?: string,
    options?: AssetStorageOptions
  ): Promise<AssetResult> {
    try {
      // Validate the asset
      await this.validateAsset(fileData, filename);
      
      // Generate SHA-256 hash
      const hash = this.generateHash(fileData);
      
      // Check if asset already exists (deduplication)
      const existingAsset = await this.getAssetMetadata(hash);
      if (existingAsset) {
        // Increment reference count
        await this.incrementRefCount(hash);
        
        // Return existing asset info
        return {
          hash,
          thumbnailHash: existingAsset.thumbnailHash || '', // Use stored thumbnail hash
          filename,
          size: existingAsset.size,
          mimetype: existingAsset.mimetype,
          dimensions: existingAsset.width && existingAsset.height ? {
            width: existingAsset.width,
            height: existingAsset.height
          } : undefined,
          storedAt: existingAsset.createdAt
        };
      }
      
      // Get image metadata
      const metadata = await sharp(fileData).metadata();
      const mimetype = this.getMimeType(metadata.format || 'unknown', filename);
      
      // Store original asset
      await this.saveAssetFile(hash, fileData);
      
      // Generate and store thumbnail if requested
      let thumbnailHash = '';
      if (options?.generateThumbnail !== false) {
        const thumbnailBuffer = await this.generateThumbnail(
          fileData,
          options?.thumbnailSize || this.config.defaultOptions?.thumbnailSize || DEFAULT_THUMBNAIL_SIZE,
          options?.quality || this.config.defaultOptions?.quality || DEFAULT_QUALITY
        );
        thumbnailHash = this.generateHash(thumbnailBuffer);
        await this.saveAssetFile(thumbnailHash, thumbnailBuffer, true);
      }
      
      // Store metadata in database
      if (this.db) {
        await this.storeAssetMetadata({
          hash,
          originalName: filename,
          mimetype,
          size: fileData.length,
          width: metadata.width,
          height: metadata.height,
          thumbnailHash,
          refCount: 1,
          createdAt: new Date(),
          lastAccessed: new Date()
        });
      }
      
      return {
        hash,
        thumbnailHash,
        filename,
        size: fileData.length,
        mimetype,
        dimensions: metadata.width && metadata.height ? {
          width: metadata.width,
          height: metadata.height
        } : undefined,
        storedAt: new Date()
      };
    } catch (error) {
      if (error instanceof AssetError) {
        throw error;
      }
      throw new AssetError(
        'STORAGE_FAILED' as AssetErrorType,
        `Failed to store asset: ${error}`,
        { filename, error }
      );
    }
  }

  /**
   * Get asset file path
   */
  async getAssetPath(hash: string, thumbnail = false): Promise<string> {
    const dir = thumbnail ? this.thumbnailsPath : this.assetsPath;
    const assetPath = path.join(dir, hash);
    
    try {
      await fs.access(assetPath);
      
      // Update last accessed time
      if (this.db) {
        this.updateLastAccessed(hash);
      }
      
      return assetPath;
    } catch {
      throw new AssetError(
        'NOT_FOUND' as AssetErrorType,
        `Asset not found: ${hash}`,
        { hash, thumbnail }
      );
    }
  }

  /**
   * Delete an asset (with reference counting)
   */
  async deleteAsset(hash: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database connection required for asset deletion');
    }
    
    try {
      // Decrement reference count
      const stmt = this.db.prepare(
        'UPDATE assets SET ref_count = ref_count - 1 WHERE hash = ?'
      );
      const result = stmt.run(hash);
      
      if (result.changes === 0) {
        return false; // Asset not found
      }
      
      // Check if reference count is now 0
      const asset = this.db.prepare(
        'SELECT ref_count FROM assets WHERE hash = ?'
      ).get(hash) as { ref_count: number } | undefined;
      
      if (asset && asset.ref_count <= 0) {
        // Get full asset metadata to find thumbnail hash
        const fullAssetInfo = await this.getAssetMetadata(hash);
        
        // Delete physical files
        const assetPath = path.join(this.assetsPath, hash);
        
        try {
          await fs.unlink(assetPath);
        } catch {
          // File might not exist
        }
        
        // Delete thumbnail using stored hash (not convention)
        if (fullAssetInfo?.thumbnailHash) {
          const thumbnailPath = path.join(this.thumbnailsPath, fullAssetInfo.thumbnailHash);
          try {
            await fs.unlink(thumbnailPath);
          } catch {
            // Thumbnail might not exist
          }
        }
        
        // Delete from database
        this.db.prepare('DELETE FROM assets WHERE hash = ?').run(hash);
        
        return true;
      }
      
      return false; // Asset still referenced
    } catch (error) {
      throw new AssetError(
        'STORAGE_FAILED' as AssetErrorType,
        `Failed to delete asset: ${error}`,
        { hash, error }
      );
    }
  }

  /**
   * Clean up orphaned assets
   */
  async cleanupOrphans(options?: AssetCleanupOptions): Promise<number> {
    if (!this.db) {
      throw new Error('Database connection required for cleanup');
    }
    
    let deletedCount = 0;
    
    try {
      // Find orphaned assets (ref_count = 0)
      let query = 'SELECT hash FROM assets WHERE ref_count <= 0';
      const params: any[] = [];
      
      // Add age filter if specified
      if (options?.removeOlderThan) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - options.removeOlderThan);
        query += ' OR last_accessed < ?';
        params.push(cutoffDate.toISOString());
      }
      
      const orphans = this.db.prepare(query).all(...params) as Array<{ hash: string }>;
      
      if (options?.dryRun) {
        console.log(`Found ${orphans.length} orphaned assets (dry run - not deleting)`);
        return orphans.length;
      }
      
      // Delete orphaned assets
      for (const orphan of orphans) {
        const deleted = await this.deleteAsset(orphan.hash);
        if (deleted) {
          deletedCount++;
        }
      }
      
      console.log(`Cleaned up ${deletedCount} orphaned assets`);
      return deletedCount;
    } catch (error) {
      throw new AssetError(
        'STORAGE_FAILED' as AssetErrorType,
        `Cleanup failed: ${error}`,
        { error }
      );
    }
  }

  /**
   * Import multiple assets (batch operation)
   */
  async importAssets(
    files: Array<{ data: Buffer; filename: string }>,
    options?: AssetStorageOptions
  ): Promise<AssetImportResult> {
    const startTime = Date.now();
    const results: AssetImportResult = {
      success: [],
      failed: [],
      duration: 0,
      duplicates: 0
    };
    
    for (const file of files) {
      try {
        const result = await this.storeAsset(file.data, file.filename, options);
        results.success.push(result);
        
        // Check if it was a duplicate
        const metadata = await this.getAssetMetadata(result.hash);
        if (metadata && metadata.refCount > 1) {
          results.duplicates++;
        }
      } catch (error) {
        results.failed.push({
          filename: file.filename,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    results.duration = Date.now() - startTime;
    return results;
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Generate SHA-256 hash
   */
  private generateHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate asset against configured rules
   */
  private async validateAsset(data: Buffer, filename?: string): Promise<void> {
    // Check file size
    if (data.length > this.validation.maxFileSize) {
      throw new AssetError(
        'FILE_TOO_LARGE' as AssetErrorType,
        `File size ${data.length} exceeds maximum ${this.validation.maxFileSize}`,
        { size: data.length, maxSize: this.validation.maxFileSize }
      );
    }
    
    // Check file type
    try {
      const metadata = await sharp(data).metadata();
      const mimetype = this.getMimeType(metadata.format || 'unknown', filename);
      
      if (!this.validation.allowedTypes.includes(mimetype)) {
        throw new AssetError(
          'INVALID_TYPE' as AssetErrorType,
          `File type ${mimetype} is not allowed`,
          { mimetype, allowedTypes: this.validation.allowedTypes }
        );
      }
      
      // Check dimensions if specified
      if (this.validation.maxDimensions) {
        if (metadata.width && metadata.width > this.validation.maxDimensions.width) {
          throw new AssetError(
            'DIMENSION_EXCEEDED' as AssetErrorType,
            `Width ${metadata.width} exceeds maximum ${this.validation.maxDimensions.width}`,
            { width: metadata.width, maxWidth: this.validation.maxDimensions.width }
          );
        }
        if (metadata.height && metadata.height > this.validation.maxDimensions.height) {
          throw new AssetError(
            'DIMENSION_EXCEEDED' as AssetErrorType,
            `Height ${metadata.height} exceeds maximum ${this.validation.maxDimensions.height}`,
            { height: metadata.height, maxHeight: this.validation.maxDimensions.height }
          );
        }
      }
      
      if (this.validation.minDimensions) {
        if (metadata.width && metadata.width < this.validation.minDimensions.width) {
          throw new AssetError(
            'DIMENSION_EXCEEDED' as AssetErrorType,
            `Width ${metadata.width} below minimum ${this.validation.minDimensions.width}`,
            { width: metadata.width, minWidth: this.validation.minDimensions.width }
          );
        }
        if (metadata.height && metadata.height < this.validation.minDimensions.height) {
          throw new AssetError(
            'DIMENSION_EXCEEDED' as AssetErrorType,
            `Height ${metadata.height} below minimum ${this.validation.minDimensions.height}`,
            { height: metadata.height, minHeight: this.validation.minDimensions.height }
          );
        }
      }
    } catch (error) {
      if (error instanceof AssetError) {
        throw error;
      }
      throw new AssetError(
        'CORRUPT_FILE' as AssetErrorType,
        'File appears to be corrupt or invalid',
        { error }
      );
    }
  }

  /**
   * Get MIME type from format
   */
  private getMimeType(format: string, filename?: string): string {
    const formatMap: Record<string, string> = {
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      svg: 'image/svg+xml'
    };
    
    // Try format first
    if (formatMap[format]) {
      return formatMap[format];
    }
    
    // Try filename extension
    if (filename) {
      const ext = path.extname(filename).toLowerCase().slice(1);
      if (formatMap[ext]) {
        return formatMap[ext];
      }
    }
    
    return 'application/octet-stream';
  }

  /**
   * Generate thumbnail
   */
  private async generateThumbnail(
    data: Buffer,
    size: { width: number; height: number },
    quality: number
  ): Promise<Buffer> {
    return sharp(data)
      .resize(size.width, size.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toBuffer();
  }

  /**
   * Save asset file to disk
   */
  private async saveAssetFile(hash: string, data: Buffer, isThumbnail = false): Promise<string> {
    const dir = isThumbnail ? this.thumbnailsPath : this.assetsPath;
    const filePath = path.join(dir, isThumbnail ? hash : hash);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, data);
    
    return filePath;
  }

  /**
   * Get asset metadata from database
   */
  private async getAssetMetadata(hash: string): Promise<AssetMetadata | null> {
    if (!this.db) {
      return null;
    }
    
    const result = this.db.prepare(
      'SELECT * FROM assets WHERE hash = ?'
    ).get(hash) as any;
    
    if (!result) {
      return null;
    }
    
    return {
      hash: result.hash,
      originalName: result.original_name,
      mimetype: result.mimetype,
      size: result.size,
      width: result.width,
      height: result.height,
      thumbnailHash: result.thumbnail_hash,
      refCount: result.ref_count,
      createdAt: new Date(result.created_at),
      lastAccessed: new Date(result.last_accessed)
    };
  }

  /**
   * Store asset metadata in database
   */
  private async storeAssetMetadata(metadata: AssetMetadata & { thumbnailHash?: string }): Promise<void> {
    if (!this.db) {
      return;
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO assets (
        hash, original_name, mimetype, size, width, height,
        thumbnail_hash, ref_count, created_at, last_accessed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      metadata.hash,
      metadata.originalName || null,
      metadata.mimetype,
      metadata.size,
      metadata.width || null,
      metadata.height || null,
      metadata.thumbnailHash || null,
      metadata.refCount,
      metadata.createdAt.toISOString(),
      metadata.lastAccessed.toISOString()
    );
  }

  /**
   * Increment reference count
   */
  private async incrementRefCount(hash: string): Promise<void> {
    if (!this.db) {
      return;
    }
    
    this.db.prepare(
      'UPDATE assets SET ref_count = ref_count + 1 WHERE hash = ?'
    ).run(hash);
  }

  /**
   * Update last accessed time
   */
  private updateLastAccessed(hash: string): void {
    if (!this.db) {
      return;
    }
    
    this.db.prepare(
      'UPDATE assets SET last_accessed = CURRENT_TIMESTAMP WHERE hash = ?'
    ).run(hash);
  }

  /**
   * Get statistics about stored assets
   */
  async getStatistics(): Promise<{
    totalCount: number;
    totalSize: number;
    thumbnailCount: number;
    orphanedCount: number;
  }> {
    if (!this.db) {
      return {
        totalCount: 0,
        totalSize: 0,
        thumbnailCount: 0,
        orphanedCount: 0
      };
    }
    
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(size) as total_size,
        COUNT(CASE WHEN ref_count <= 0 THEN 1 END) as orphaned_count
      FROM assets
    `).get() as any;
    
    // Count thumbnails by checking filesystem
    let thumbnailCount = 0;
    try {
      const thumbnails = await fs.readdir(this.thumbnailsPath);
      thumbnailCount = thumbnails.length;
    } catch {
      // Directory might not exist yet
    }
    
    return {
      totalCount: stats.total_count || 0,
      totalSize: stats.total_size || 0,
      thumbnailCount,
      orphanedCount: stats.orphaned_count || 0
    };
  }
}