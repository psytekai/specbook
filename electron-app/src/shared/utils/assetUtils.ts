/**
 * Generate asset protocol URL from hash
 */
export function getAssetUrl(hash: string | undefined | null): string | undefined {
  if (!hash) return undefined;
  return `asset://${hash}`;
}

/**
 * Get the best available image URL for a product
 * Priority: thumbnail -> primary image -> undefined
 */
export function getProductImageUrl(product: {
  primaryThumbnailHash?: string;
  primaryImageHash?: string;
}): string | undefined {
  return getAssetUrl(product.primaryThumbnailHash) 
    || getAssetUrl(product.primaryImageHash)
    || undefined;
}

/**
 * Get all image URLs for a product
 */
export function getProductImageUrls(product: {
  primaryImageHash?: string;
  additionalImagesHashes?: string[];
}): string[] {
  const urls: string[] = [];
  
  const primaryUrl = getAssetUrl(product.primaryImageHash);
  if (primaryUrl) urls.push(primaryUrl);
  
  if (product.additionalImagesHashes) {
    product.additionalImagesHashes.forEach(hash => {
      const url = getAssetUrl(hash);
      if (url) urls.push(url);
    });
  }
  
  return urls;
}

/**
 * Get placeholder image URL
 */
export function getPlaceholderImage(): string {
  return '/placeholder-product.png';
}