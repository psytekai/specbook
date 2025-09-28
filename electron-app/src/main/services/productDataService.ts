import { Product } from '../../shared/types';
import { ProductForExport, PDFExportConfig } from '../../shared/types/exportTypes';
import { EXPORT_CONFIG, validateConfiguration } from '../../shared/config/exportConfig';

export class ProductDataService {
  /**
   * Converts Product objects to ProductForExport format
   */
  static convertProductsForExport(products: Product[]): ProductForExport[] {
    return products.map(product => ({
      id: product.id,
      productName: product.productName,
      type: product.type,
      specificationDescription: product.specificationDescription,
      url: product.url,
      tagId: product.tagId,
      category: product.category,
      location: product.location,
      manufacturer: product.manufacturer,
      price: product.price,
      primaryImageHash: product.primaryImageHash,
      primaryThumbnailHash: product.primaryThumbnailHash,
    }));
  }

  /**
   * Filters products based on export configuration
   */
  static filterProducts(products: ProductForExport[], config: PDFExportConfig): ProductForExport[] {
    if (!config.filters) {
      return products;
    }

    return products.filter(product => {
      // Search filter
      if (config.filters!.search) {
        const searchTerm = config.filters!.search.toLowerCase();
        const searchableText = [
          product.productName,
          product.type,
          product.specificationDescription,
          product.manufacturer,
          product.tagId,
          ...product.category,
          ...product.location,
        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      // Category filter
      if (config.filters!.category) {
        if (!product.category.some(cat =>
          cat.toLowerCase().includes(config.filters!.category!.toLowerCase())
        )) {
          return false;
        }
      }

      // Location filter
      if (config.filters!.location) {
        if (!product.location.some(loc =>
          loc.toLowerCase().includes(config.filters!.location!.toLowerCase())
        )) {
          return false;
        }
      }

      // Manufacturer filter
      if (config.filters!.manufacturer) {
        if (!product.manufacturer ||
            !product.manufacturer.toLowerCase().includes(config.filters!.manufacturer.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Gets default column configuration for PDF export
   * Uses single source of truth from exportConfig
   */
  static getDefaultColumnConfig() {
    return EXPORT_CONFIG.columns;
  }

  /**
   * Validates export configuration using single source of truth
   */
  static validateExportConfig(config: PDFExportConfig): { valid: boolean; errors: string[] } {
    return validateConfiguration(config.orientation);
  }

  /**
   * Gets statistics about the export data
   */
  static getExportStatistics(products: ProductForExport[], config: PDFExportConfig) {
    const filteredProducts = this.filterProducts(products, config);

    // Group statistics
    const groups = new Map<string, number>();

    filteredProducts.forEach(product => {
      let groupKeys: string[] = [];

      if (config.groupBy === 'category') {
        groupKeys = product.category.length > 0 ? product.category : ['Uncategorized'];
      } else if (config.groupBy === 'location') {
        groupKeys = product.location.length > 0 ? product.location : ['No Location'];
      }

      groupKeys.forEach(groupKey => {
        groups.set(groupKey, (groups.get(groupKey) || 0) + 1);
      });
    });

    // Calculate estimated pages (rough estimate)
    const rowsPerPage = config.orientation === 'landscape' ? 15 : 12;
    const estimatedPages = Math.ceil(filteredProducts.length / rowsPerPage) + groups.size; // Add pages for group headers

    return {
      totalProducts: products.length,
      filteredProducts: filteredProducts.length,
      groupCount: groups.size,
      estimatedPages,
      groups: Array.from(groups.entries()).map(([name, count]) => ({ name, count })),
      hasImages: filteredProducts.some(p => p.primaryImageHash || p.primaryThumbnailHash),
      averageSpecLength: filteredProducts.reduce((sum, p) =>
        sum + (p.specificationDescription?.length || 0), 0) / filteredProducts.length,
    };
  }

  /**
   * Prepares export configuration with defaults from single source of truth
   */
  static prepareExportConfig(partialConfig: Partial<PDFExportConfig>): PDFExportConfig {
    return {
      ...EXPORT_CONFIG.defaults,
      ...partialConfig,
      columns: partialConfig.columns || EXPORT_CONFIG.columns,
    };
  }
}
