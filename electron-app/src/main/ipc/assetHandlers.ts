import { ipcMain } from 'electron';
import { AssetManager } from '../services/AssetManager';
import { ProjectState } from '../services/ProjectState';
import type { AssetStorageOptions } from '../types/asset.types';

/**
 * Asset IPC handlers for managing images with content-addressable storage
 */
export function setupAssetIPC(): void {
  const projectState = ProjectState.getInstance();

  /**
   * Upload and store an asset
   */
  ipcMain.handle('asset:upload', async (_event, fileData: ArrayBuffer, filename: string, _mimetype: string, options?: AssetStorageOptions) => {
    try {
      const state = projectState.getStateInfo();
      const manager = projectState.getManager();

      if (!state.isOpen || !manager || !state.project?.path) {
        throw new Error('No project open');
      }

      // Convert ArrayBuffer to Buffer
      const buffer = Buffer.from(fileData);

      // Create AssetManager for current project
      const assetManager = new AssetManager(
        state.project.path,
        manager.getDatabase() || undefined
      );

      // Store the asset
      const result = await assetManager.storeAsset(buffer, filename, options);

      // Mark project as dirty
      projectState.markDirty();

      return {
        success: true,
        data: {
          hash: result.hash,
          thumbnailHash: result.thumbnailHash,
          url: `asset://${result.hash}`,
          thumbnailUrl: result.thumbnailHash ? `asset://${result.thumbnailHash}` : undefined,
          filename: result.filename,
          size: result.size,
          mimetype: result.mimetype,
          dimensions: result.dimensions,
          storedAt: result.storedAt
        }
      };
    } catch (error) {
      console.error('Asset upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  });

  /**
   * Get asset file path for serving
   */
  ipcMain.handle('asset:get-path', async (_event, hash: string, thumbnail: boolean = false) => {
    try {
      const state = projectState.getStateInfo();

      if (!state.isOpen || !state.project?.path) {
        throw new Error('No project open');
      }

      // Create AssetManager for current project
      const assetManager = new AssetManager(state.project.path);

      // Get asset path
      const assetPath = await assetManager.getAssetPath(hash, thumbnail);

      return {
        success: true,
        data: { path: assetPath }
      };
    } catch (error) {
      console.error('Asset path retrieval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Asset not found'
      };
    }
  });

  /**
   * Delete an asset (decrements reference count)
   */
  ipcMain.handle('asset:delete', async (_event, hash: string) => {
    try {
      const state = projectState.getStateInfo();
      const manager = projectState.getManager();

      if (!state.isOpen || !manager || !state.project?.path) {
        throw new Error('No project open');
      }

      // Create AssetManager for current project
      const assetManager = new AssetManager(
        state.project.path,
        manager.getDatabase() || undefined
      );

      // Delete the asset
      const deleted = await assetManager.deleteAsset(hash);

      if (deleted) {
        projectState.markDirty();
      }

      return {
        success: true,
        data: { deleted }
      };
    } catch (error) {
      console.error('Asset deletion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deletion failed'
      };
    }
  });

  /**
   * Clean up orphaned assets
   */
  ipcMain.handle('asset:cleanup', async (_event, options?: { removeOlderThan?: number; dryRun?: boolean }) => {
    try {
      const state = projectState.getStateInfo();
      const manager = projectState.getManager();

      if (!state.isOpen || !manager || !state.project?.path) {
        throw new Error('No project open');
      }

      // Create AssetManager for current project
      const assetManager = new AssetManager(
        state.project.path,
        manager.getDatabase() || undefined
      );

      // Clean up orphaned assets
      const deletedCount = await assetManager.cleanupOrphans(options);

      if (deletedCount > 0 && !options?.dryRun) {
        projectState.markDirty();
      }

      return {
        success: true,
        data: { deletedCount, dryRun: options?.dryRun || false }
      };
    } catch (error) {
      console.error('Asset cleanup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed'
      };
    }
  });

  /**
   * Import multiple assets in batch
   */
  ipcMain.handle('asset:import-batch', async (_event, files: Array<{ data: ArrayBuffer; filename: string }>, options?: AssetStorageOptions) => {
    try {
      const state = projectState.getStateInfo();
      const manager = projectState.getManager();

      if (!state.isOpen || !manager || !state.project?.path) {
        throw new Error('No project open');
      }

      // Create AssetManager for current project
      const assetManager = new AssetManager(
        state.project.path,
        manager.getDatabase() || undefined
      );

      // Convert ArrayBuffers to Buffers
      const processedFiles = files.map(file => ({
        data: Buffer.from(file.data),
        filename: file.filename
      }));

      // Import assets
      const result = await assetManager.importAssets(processedFiles, options);

      // Mark project as dirty if any assets were imported
      if (result.success.length > 0) {
        projectState.markDirty();
      }

      return {
        success: true,
        data: {
          imported: result.success.length,
          failed: result.failed.length,
          duplicates: result.duplicates,
          duration: result.duration,
          failures: result.failed
        }
      };
    } catch (error) {
      console.error('Batch asset import failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch import failed'
      };
    }
  });

  /**
   * Get asset storage statistics
   */
  ipcMain.handle('asset:statistics', async (_event) => {
    try {
      const state = projectState.getStateInfo();
      const manager = projectState.getManager();

      if (!state.isOpen || !manager || !state.project?.path) {
        return {
          success: true,
          data: {
            totalCount: 0,
            totalSize: 0,
            thumbnailCount: 0,
            orphanedCount: 0
          }
        };
      }

      // Create AssetManager for current project
      const assetManager = new AssetManager(
        state.project.path,
        manager.getDatabase() || undefined
      );

      // Get statistics
      const stats = await assetManager.getStatistics();

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Asset statistics retrieval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Statistics retrieval failed'
      };
    }
  });

  console.log('✅ Asset IPC handlers registered');
}