import { PDFExportService } from '../pdfExportService';
import { ProductDataService } from '../productDataService';
import { PDFExportConfig, ProductForExport } from '../../../shared/types/exportTypes';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PDFExportService', () => {
  let pdfService: PDFExportService;
  let testOutputPath: string;

  beforeEach(() => {
    pdfService = new PDFExportService();
    testOutputPath = path.join(os.tmpdir(), `test-export-${Date.now()}.pdf`);
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testOutputPath)) {
      fs.unlinkSync(testOutputPath);
    }
  });

  const createTestProducts = (): ProductForExport[] => [
    {
      id: '1',
      productName: 'Test Product 1',
      type: 'Hardware',
      specificationDescription: 'A test product for PDF export',
      url: 'https://example.com/product1',
      tagId: 'TAG001',
      category: ['Electronics', 'Hardware'],
      location: ['Warehouse A'],
      manufacturer: 'Test Manufacturer',
      price: 99.99,
    },
    {
      id: '2',
      productName: 'Test Product 2',
      type: 'Software',
      specificationDescription: 'Another test product',
      url: 'https://example.com/product2',
      tagId: 'TAG002',
      category: ['Software'],
      location: ['Warehouse B'],
      manufacturer: 'Another Manufacturer',
      price: 149.99,
    },
  ];

  const createTestConfig = (): PDFExportConfig => ({
    groupBy: 'category',
    sortBy: 'tagId',
    includeImages: false, // Disable images for testing
    includeHeaders: true,
    pageSize: 'A4',
    orientation: 'portrait',
    columns: ProductDataService.getDefaultColumnConfig().filter(col => 
      ['productName', 'type', 'specificationDescription', 'url', 'tagId'].includes(col.key)
    ),
    scope: 'currentView',
  });

  describe('generateProductPDF', () => {
    it('should generate a PDF file successfully', async () => {
      const products = createTestProducts();
      const config = createTestConfig();

      const result = await pdfService.generateProductPDF(products, config, testOutputPath);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(testOutputPath);
      expect(result.metadata.productCount).toBe(2);
      expect(result.metadata.pageCount).toBeGreaterThan(0);
      expect(fs.existsSync(testOutputPath)).toBe(true);
    });

    it('should handle empty product list', async () => {
      const products: ProductForExport[] = [];
      const config = createTestConfig();

      const result = await pdfService.generateProductPDF(products, config, testOutputPath);

      expect(result.success).toBe(true);
      expect(result.metadata.productCount).toBe(0);
      expect(fs.existsSync(testOutputPath)).toBe(true);
    });

    it('should group products by category correctly', async () => {
      const products = createTestProducts();
      const config = createTestConfig();
      config.groupBy = 'category';

      const result = await pdfService.generateProductPDF(products, config, testOutputPath);

      expect(result.success).toBe(true);
      expect(result.metadata.groupCount).toBeGreaterThan(0);
    });

    it('should group products by location correctly', async () => {
      const products = createTestProducts();
      const config = createTestConfig();
      config.groupBy = 'location';

      const result = await pdfService.generateProductPDF(products, config, testOutputPath);

      expect(result.success).toBe(true);
      expect(result.metadata.groupCount).toBeGreaterThan(0);
    });

    it('should handle landscape orientation', async () => {
      const products = createTestProducts();
      const config = createTestConfig();
      config.orientation = 'landscape';

      const result = await pdfService.generateProductPDF(products, config, testOutputPath);

      expect(result.success).toBe(true);
      expect(fs.existsSync(testOutputPath)).toBe(true);
    });

    it('should report progress during generation', async () => {
      const products = createTestProducts();
      const config = createTestConfig();
      const progressUpdates: any[] = [];

      pdfService.setProgressCallback((progress) => {
        progressUpdates.push(progress);
      });

      const result = await pdfService.generateProductPDF(products, config, testOutputPath);

      expect(result.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].stage).toBe('preparing');
      expect(progressUpdates[progressUpdates.length - 1].stage).toBe('complete');
    });
  });
});

describe('ProductDataService', () => {
  describe('validateExportConfig', () => {
    it('should validate a correct configuration', () => {
      const config: PDFExportConfig = {
        groupBy: 'category',
        sortBy: 'tagId',
        includeImages: true,
        includeHeaders: true,
        pageSize: 'A4',
        orientation: 'portrait',
        columns: ProductDataService.getDefaultColumnConfig()
          .filter(col => ['productName', 'type', 'url', 'tagId'].includes(col.key))
          .map(col => ({ ...col, visible: true })),
        scope: 'currentView',
      };

      const result = ProductDataService.validateExportConfig(config);
      if (!result.valid) {
        console.log('Validation errors:', result.errors);
      }
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration with no visible columns', () => {
      const config: PDFExportConfig = {
        groupBy: 'category',
        sortBy: 'tagId',
        includeImages: true,
        includeHeaders: true,
        pageSize: 'A4',
        orientation: 'portrait',
        columns: ProductDataService.getDefaultColumnConfig().map(col => ({ ...col, visible: false })),
        scope: 'currentView',
      };

      const result = ProductDataService.validateExportConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getExportStatistics', () => {
    it('should calculate statistics correctly', () => {
      const products: ProductForExport[] = [
        {
          id: '1',
          productName: 'Product 1',
          category: ['Electronics'],
          location: ['Warehouse A'],
          url: 'https://example.com/1',
          tagId: 'TAG001',
        },
        {
          id: '2',
          productName: 'Product 2',
          category: ['Electronics'],
          location: ['Warehouse B'],
          url: 'https://example.com/2',
          tagId: 'TAG002',
        },
      ] as ProductForExport[];

      const config: PDFExportConfig = {
        groupBy: 'category',
        sortBy: 'tagId',
        includeImages: true,
        includeHeaders: true,
        pageSize: 'A4',
        orientation: 'portrait',
        columns: ProductDataService.getDefaultColumnConfig(),
        scope: 'currentView',
      };

      const stats = ProductDataService.getExportStatistics(products, config);

      expect(stats.totalProducts).toBe(2);
      expect(stats.filteredProducts).toBe(2);
      expect(stats.groupCount).toBe(1);
      expect(stats.estimatedPages).toBeGreaterThan(0);
    });
  });
});
