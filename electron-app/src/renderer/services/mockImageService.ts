// Mock Image Service for handling image uploads and management
// In a real application, this would interface with a backend service

export interface ImageUploadResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  metadata?: ImageMetadata;
}

export interface ImageMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  uploadedAt: Date;
}

export interface ImageValidationError {
  type: 'SIZE' | 'FORMAT' | 'DIMENSIONS' | 'UNKNOWN';
  message: string;
}

class MockImageService {
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  private readonly MAX_DIMENSIONS = { width: 4000, height: 4000 };

  /**
   * Validates an image file before upload
   */
  validateImage(file: File): ImageValidationError | null {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        type: 'SIZE',
        message: `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.MAX_FILE_SIZE)})`
      };
    }

    // Check file type
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return {
        type: 'FORMAT',
        message: `File type ${file.type} is not supported. Allowed types: ${this.ALLOWED_TYPES.map(type => type.split('/')[1]).join(', ')}`
      };
    }

    return null;
  }

  /**
   * Validates image dimensions
   */
  private async validateImageDimensions(file: File): Promise<ImageValidationError | null> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        
        if (img.width > this.MAX_DIMENSIONS.width || img.height > this.MAX_DIMENSIONS.height) {
          resolve({
            type: 'DIMENSIONS',
            message: `Image dimensions (${img.width}x${img.height}) exceed maximum allowed dimensions (${this.MAX_DIMENSIONS.width}x${this.MAX_DIMENSIONS.height})`
          });
        } else {
          resolve(null);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({
          type: 'FORMAT',
          message: 'Unable to read image file'
        });
      };

      img.src = url;
    });
  }

  /**
   * Gets image metadata
   */
  private async getImageMetadata(file: File): Promise<ImageMetadata> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          width: img.width,
          height: img.height,
          uploadedAt: new Date()
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          uploadedAt: new Date()
        });
      };

      img.src = url;
    });
  }

  /**
   * Uploads an image file (mock implementation)
   */
  async uploadImage(file: File): Promise<ImageUploadResult> {
    try {
      // Validate file
      const validationError = this.validateImage(file);
      if (validationError) {
        return {
          success: false,
          error: validationError.message
        };
      }

      // Validate dimensions
      const dimensionError = await this.validateImageDimensions(file);
      if (dimensionError) {
        return {
          success: false,
          error: dimensionError.message
        };
      }

      // Get metadata
      const metadata = await this.getImageMetadata(file);

      // Simulate upload delay
      await this.simulateDelay(500 + Math.random() * 1000);

      // Create mock URL (in a real app, this would be a server URL)
      const imageUrl = URL.createObjectURL(file);

      // Store metadata in sessionStorage for persistence during session
      this.storeImageMetadata(imageUrl, metadata);

      return {
        success: true,
        imageUrl,
        metadata
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during upload'
      };
    }
  }

  /**
   * Optimizes image for web display (mock implementation)
   */
  async optimizeImage(file: File, maxWidth: number = 800, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const url = URL.createObjectURL(file);

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = () => {
        URL.revokeObjectURL(url);

        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        const newWidth = img.width * ratio;
        const newHeight = img.height * ratio;

        // Set canvas size
        canvas.width = newWidth;
        canvas.height = newHeight;

        // Draw and compress
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const optimizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(optimizedFile);
            } else {
              reject(new Error('Failed to optimize image'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for optimization'));
      };

      img.src = url;
    });
  }

  /**
   * Deletes an image (mock implementation)
   */
  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      // Simulate API delay
      await this.simulateDelay(300);

      // Revoke object URL to free memory
      if (imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }

      // Remove metadata from storage
      this.removeImageMetadata(imageUrl);

      return true;
    } catch (error) {
      console.error('Failed to delete image:', error);
      return false;
    }
  }

  /**
   * Gets stored image metadata
   */
  getStoredImageMetadata(imageUrl: string): ImageMetadata | null {
    try {
      const stored = sessionStorage.getItem(`image_metadata_${btoa(imageUrl)}`);
      if (stored) {
        const metadata = JSON.parse(stored);
        // Convert uploadedAt back to Date object
        metadata.uploadedAt = new Date(metadata.uploadedAt);
        return metadata;
      }
      return null;
    } catch (error) {
      console.error('Failed to retrieve image metadata:', error);
      return null;
    }
  }

  /**
   * Stores image metadata in sessionStorage
   */
  private storeImageMetadata(imageUrl: string, metadata: ImageMetadata): void {
    try {
      const key = `image_metadata_${btoa(imageUrl)}`;
      sessionStorage.setItem(key, JSON.stringify(metadata));
    } catch (error) {
      console.error('Failed to store image metadata:', error);
    }
  }

  /**
   * Removes image metadata from storage
   */
  private removeImageMetadata(imageUrl: string): void {
    try {
      const key = `image_metadata_${btoa(imageUrl)}`;
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove image metadata:', error);
    }
  }

  /**
   * Formats file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Utility function for creating delays
   */
  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets all allowed image types
   */
  getAllowedTypes(): string[] {
    return [...this.ALLOWED_TYPES];
  }

  /**
   * Gets maximum file size
   */
  getMaxFileSize(): number {
    return this.MAX_FILE_SIZE;
  }

  /**
   * Gets maximum dimensions
   */
  getMaxDimensions(): { width: number; height: number } {
    return { ...this.MAX_DIMENSIONS };
  }

  /**
   * Batch upload multiple images
   */
  async uploadMultipleImages(files: File[]): Promise<ImageUploadResult[]> {
    const results: ImageUploadResult[] = [];
    
    for (const file of files) {
      const result = await this.uploadImage(file);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Creates a thumbnail from an image file
   */
  async createThumbnail(file: File, size: number = 150): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const url = URL.createObjectURL(file);

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = () => {
        URL.revokeObjectURL(url);

        // Set canvas to square thumbnail size
        canvas.width = size;
        canvas.height = size;

        // Calculate crop area for square thumbnail
        const minDimension = Math.min(img.width, img.height);
        const x = (img.width - minDimension) / 2;
        const y = (img.height - minDimension) / 2;

        // Draw cropped and scaled image
        ctx.drawImage(img, x, y, minDimension, minDimension, 0, 0, size, size);

        // Convert to data URL
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(thumbnailUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to create thumbnail'));
      };

      img.src = url;
    });
  }
}

// Export singleton instance
export const mockImageService = new MockImageService();
export default mockImageService;