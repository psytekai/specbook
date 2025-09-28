import { Product } from '../../shared/types';
import { ProductForExport, PDFExportConfig } from '../../shared/types/exportTypes';

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
   */
  static getDefaultColumnConfig() {
    return [
      {
        key: 'image',
        label: 'Image',
        width: 70,
        visible: true,
        essential: false,
      },
      {
        key: 'productName',
        label: 'Product Name',
        width: 200,
        visible: true,
        essential: true,
      },
      {
        key: 'type',
        label: 'Type',
        width: 100,
        visible: true,
        essential: false,
      },
      {
        key: 'specificationDescription',
        label: 'Specification',
        width: 250,
        visible: true,
        essential: false,
      },
      {
        key: 'url',
        label: 'Link',
        width: 60,
        visible: true,
        essential: true,
      },
      {
        key: 'tagId',
        label: 'Tag ID',
        width: 80,
        visible: true,
        essential: true,
      },
      {
        key: 'manufacturer',
        label: 'Manufacturer',
        width: 120,
        visible: false,
        essential: false,
      },
      {
        key: 'price',
        label: 'Price',
        width: 80,
        visible: false,
        essential: false,
      },
      {
        key: 'category',
        label: 'Category',
        width: 120,
        visible: false,
        essential: false,
      },
      {
        key: 'location',
        label: 'Location',
        width: 120,
        visible: false,
        essential: false,
      },
    ];
  }

  /**
   * Validates export configuration
   */
  static validateExportConfig(config: PDFExportConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if at least one column is visible
    const visibleColumns = config.columns.filter(col => col.visible);
    if (visibleColumns.length === 0) {
      errors.push('At least one column must be visible for export');
    }

    // Check if essential columns are present
    const visibleColumnKeys = visibleColumns.map(col => col.key);
    const requiredEssentialColumns = ['productName', 'url', 'tagId'];
    
    requiredEssentialColumns.forEach(required => {
      if (!visibleColumnKeys.includes(required)) {
        errors.push(`Essential column '${required}' must be visible`);
      }
    });

    // Validate column widths (only if columns have width defined)
    const columnsWithWidth = visibleColumns.filter(col => col.width && col.width > 0);
    if (columnsWithWidth.length > 0) {
      const totalWidth = columnsWithWidth.reduce((sum, col) => sum + col.width, 0);
      const maxWidth = config.orientation === 'landscape' ? 750 : 500; // Approximate usable width
      
      if (totalWidth > maxWidth) {
        errors.push(`Total column width (${totalWidth}px) exceeds page width. Consider reducing column widths or using landscape orientation.`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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
   * Prepares export configuration with defaults
   */
  static prepareExportConfig(partialConfig: Partial<PDFExportConfig>): PDFExportConfig {
    const defaultConfig: PDFExportConfig = {
      groupBy: 'category',
      sortBy: 'name',
      includeImages: true,
      includeHeaders: true,
      pageSize: 'A4',
      orientation: 'portrait',
      columns: this.getDefaultColumnConfig(),
      scope: 'currentView',
    };

    return {
      ...defaultConfig,
      ...partialConfig,
      columns: partialConfig.columns || defaultConfig.columns,
    };
  }
}
