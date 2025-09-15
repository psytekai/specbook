import { ipcMain } from 'electron';
import { AssetManager } from '../services/AssetManager';
import { ProjectState } from '../services/ProjectState';
import type { AssetStorageOptions } from '../types/asset.types';
import { net } from 'electron';

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

      console.log('🔄 Asset upload starting:', {
        filename,
        fileSize: fileData.byteLength,
        hasState: !!state,
        isOpen: state.isOpen,
        hasManager: !!manager,
        projectPath: state.project?.path
      });

      if (!state.isOpen || !manager || !state.project?.path) {
        const errorMsg = `No project open - isOpen: ${state.isOpen}, hasManager: ${!!manager}, projectPath: ${state.project?.path}`;
        console.error('❌ Asset upload failed:', errorMsg);
        throw new Error('No project open');
      }

      // Convert ArrayBuffer to Buffer
      const buffer = Buffer.from(fileData);
      console.log('🔄 Converted ArrayBuffer to Buffer, size:', buffer.length);

      // Create AssetManager for current project
      const assetManager = new AssetManager(
        state.project.path,
        manager.getDatabase() || undefined
      );

      console.log('🔄 Created AssetManager for project path:', state.project.path);
      console.log('🔄 Assets will be stored in:', `${state.project.path}/assets`);
      console.log('🔄 Thumbnails will be stored in:', `${state.project.path}/assets/thumbnails`);

      // Store the asset
      console.log('🔄 Calling assetManager.storeAsset()...');
      const result = await assetManager.storeAsset(buffer, filename, options);
      
      console.log('✅ Asset stored successfully:', {
        hash: result.hash,
        thumbnailHash: result.thumbnailHash,
        filename: result.filename,
        size: result.size,
        storedAt: result.storedAt
      });

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
      console.error('❌ Asset upload failed with error:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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

  /**
   * Download image from URL and store as asset
   */
  ipcMain.handle('asset:download-from-url', async (_event, imageUrl: string, filename?: string) => {
    try {
      const state = projectState.getStateInfo();
      const manager = projectState.getManager();

      console.log('🔄 Asset download from URL starting:', { imageUrl, filename });

      if (!state.isOpen || !manager || !state.project?.path) {
        const errorMsg = `No project open - isOpen: ${state.isOpen}, hasManager: ${!!manager}, projectPath: ${state.project?.path}`;
        console.error('❌ Asset download failed:', errorMsg);
        throw new Error('No project open');
      }

      // Download image using Electron's net module (bypasses CSP)
      console.log('🔄 Downloading image from:', imageUrl);
      const request = net.request(imageUrl);

      const downloadPromise = new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];

        request.on('response', (response) => {
          console.log('🔄 Response status:', response.statusCode);
          console.log('🔄 Response headers:', response.headers);

          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
            return;
          }

          // Validate content type
          const contentType = response.headers['content-type'];
          if (Array.isArray(contentType) ? !contentType[0]?.startsWith('image/') : !contentType?.startsWith('image/')) {
            reject(new Error('Downloaded content is not an image'));
            return;
          }

          response.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            console.log('✅ Image downloaded, size:', buffer.length, 'bytes');
            resolve(buffer);
          });

          response.on('error', (error) => {
            console.error('❌ Response error:', error);
            reject(error);
          });
        });

        request.on('error', (error) => {
          console.error('❌ Request error:', error);
          reject(error);
        });

        request.end();
      });

      const buffer = await downloadPromise;

      // Generate filename if not provided
      if (!filename) {
        const urlParts = imageUrl.split('/');
        const originalName = urlParts[urlParts.length - 1] || 'downloaded-image';
        filename = originalName.includes('.') ? originalName : `downloaded-image-${Date.now()}.jpg`;
      }

      console.log('🔄 Storing downloaded image as asset...');

      // Create AssetManager for current project
      const assetManager = new AssetManager(
        state.project.path,
        manager.getDatabase() || undefined
      );

      // Store the downloaded image as an asset
      const result = await assetManager.storeAsset(buffer, filename);

      console.log('✅ Downloaded image stored as asset:', {
        hash: result.hash,
        thumbnailHash: result.thumbnailHash,
        filename: result.filename,
        size: result.size
      });

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
          storedAt: result.storedAt,
          sourceUrl: imageUrl
        }
      };
    } catch (error) {
      console.error('❌ Asset download from URL failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  });

  console.log('✅ Asset IPC handlers registered');
}