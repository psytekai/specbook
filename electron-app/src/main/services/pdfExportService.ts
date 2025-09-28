import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import { AssetManager } from './AssetManager';
import { ProjectState } from './ProjectState';
import { 
  PDFExportConfig, 
  PDFGenerationResult, 
  PDFGenerationProgress, 
  GroupedProductData, 
  ProductForExport,
  PDFLayoutConfig,
  DEFAULT_PDF_LAYOUT 
} from '../../shared/types/exportTypes';

export class PDFExportService {
  private layout: PDFLayoutConfig;
  private progressCallback?: (progress: PDFGenerationProgress) => void;

  constructor(layout: PDFLayoutConfig = DEFAULT_PDF_LAYOUT) {
    this.layout = layout;
  }

  setProgressCallback(callback: (progress: PDFGenerationProgress) => void) {
    this.progressCallback = callback;
  }

  private reportProgress(stage: PDFGenerationProgress['stage'], progress: number, message: string, currentItem?: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message, currentItem });
    }
  }

  async generateProductPDF(
    products: ProductForExport[],
    config: PDFExportConfig,
    outputPath: string
  ): Promise<PDFGenerationResult> {
    const startTime = Date.now();
    
    try {
      this.reportProgress('preparing', 0, 'Preparing data for export...');

      // Group and sort products
      const groupedData = this.groupAndSortProducts(products, config);
      
      this.reportProgress('generating_pdf', 25, 'Creating PDF document...');

      // Create PDF document
      const doc = await this.createPDFDocument(groupedData, config);
      
      this.reportProgress('saving', 90, 'Saving PDF file...');

      // Save to file
      await this.savePDFToFile(doc, outputPath);
      
      this.reportProgress('complete', 100, 'Export completed successfully!');

      const endTime = Date.now();
      const stats = fs.statSync(outputPath);

      return {
        success: true,
        filePath: outputPath,
        metadata: {
          pageCount: Math.max(1, doc.bufferedPageRange()?.count || 1),
          fileSize: stats.size,
          generationTime: endTime - startTime,
          productCount: products.length,
          groupCount: groupedData.length,
        },
      };
    } catch (error) {
      console.error('PDF generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          pageCount: 0,
          fileSize: 0,
          generationTime: Date.now() - startTime,
          productCount: products.length,
          groupCount: 0,
        },
      };
    }
  }

  private groupAndSortProducts(products: ProductForExport[], config: PDFExportConfig): GroupedProductData[] {
    // Group products
    const groups = new Map<string, ProductForExport[]>();

    products.forEach(product => {
      let groupKeys: string[] = [];
      
      if (config.groupBy === 'category') {
        groupKeys = product.category.length > 0 ? product.category : ['Uncategorized'];
      } else if (config.groupBy === 'location') {
        groupKeys = product.location.length > 0 ? product.location : ['No Location'];
      }

      // A product can belong to multiple groups (e.g., multiple categories)
      groupKeys.forEach(groupKey => {
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(product);
      });
    });

    // Sort products within each group
    const sortedGroups: GroupedProductData[] = [];
    
    for (const [groupName, groupProducts] of groups) {
      const sortedProducts = this.sortProducts(groupProducts, config.sortBy);
      sortedGroups.push({
        groupName,
        products: sortedProducts,
        totalCount: sortedProducts.length,
      });
    }

    // Sort groups alphabetically
    sortedGroups.sort((a, b) => a.groupName.localeCompare(b.groupName));

    return sortedGroups;
  }

  private sortProducts(products: ProductForExport[], sortBy: PDFExportConfig['sortBy']): ProductForExport[] {
    return [...products].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.productName.localeCompare(b.productName);
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        case 'manufacturer':
          return (a.manufacturer || '').localeCompare(b.manufacturer || '');
        case 'price':
          return (a.price || 0) - (b.price || 0);
        default:
          return a.productName.localeCompare(b.productName);
      }
    });
  }

  private async createPDFDocument(groupedData: GroupedProductData[], config: PDFExportConfig): Promise<PDFKit.PDFDocument> {
    // Determine page size
    const pageSize = config.pageSize === 'A4' ? 'A4' : 'LETTER';
    const landscape = config.orientation === 'landscape';

    const doc = new PDFDocument({
      size: pageSize,
      layout: landscape ? 'landscape' : 'portrait',
      margins: this.layout.margins,
      bufferPages: true,
    });

    // Add document header
    this.addDocumentHeader(doc, config, groupedData);

    let currentY = doc.y + this.layout.spacing.sectionGap;

    // Add each group
    for (let groupIndex = 0; groupIndex < groupedData.length; groupIndex++) {
      const group = groupedData[groupIndex];
      
      // Check if we need a new page for the group
      if (currentY > doc.page.height - 200) {
        doc.addPage();
        currentY = this.layout.margins.top;
      }

      // Add group header
      currentY = this.addGroupHeader(doc, group, currentY);

      // Add table header if enabled
      if (config.includeHeaders) {
        currentY = this.addTableHeader(doc, config, currentY);
      }

      // Add products
      for (let productIndex = 0; productIndex < group.products.length; productIndex++) {
        const product = group.products[productIndex];
        
        // Check if we need a new page
        if (currentY > doc.page.height - this.layout.spacing.rowHeight - this.layout.margins.bottom) {
          doc.addPage();
          currentY = this.layout.margins.top;
          
          // Re-add table header on new page
          if (config.includeHeaders) {
            currentY = this.addTableHeader(doc, config, currentY);
          }
        }

        currentY = await this.addProductRow(doc, product, config, currentY);
        
        this.reportProgress(
          'generating_pdf',
          25 + Math.floor((groupIndex * group.products.length + productIndex + 1) / 
            groupedData.reduce((sum, g) => sum + g.products.length, 0) * 60),
          `Processing ${product.productName}...`,
          product.productName
        );
      }

      currentY += this.layout.spacing.sectionGap;
    }

    // Add footer to all pages
    this.addDocumentFooter(doc);

    return doc;
  }

  private addDocumentHeader(doc: PDFKit.PDFDocument, config: PDFExportConfig, groupedData: GroupedProductData[]): void {
    const totalProducts = groupedData.reduce((sum, group) => sum + group.totalCount, 0);
    
    // Title
    doc.fontSize(20)
       .font(this.layout.fonts.header)
       .fillColor(this.layout.colors.primary)
       .text('Product Export Report', this.layout.margins.left, this.layout.margins.top);

    // Export info
    doc.fontSize(10)
       .font(this.layout.fonts.body)
       .fillColor(this.layout.colors.secondary)
       .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' })
       .text(`Total Products: ${totalProducts}`, { align: 'right' })
       .text(`Grouped by: ${config.groupBy}`, { align: 'right' })
       .text(`Sorted by: ${config.sortBy}`, { align: 'right' });

    // Add filters info if present
    if (config.filters && Object.values(config.filters).some(filter => filter)) {
      doc.moveDown(0.5)
         .fontSize(9)
         .fillColor(this.layout.colors.text)
         .text('Active Filters:', { align: 'right' });
      
      Object.entries(config.filters).forEach(([key, value]) => {
        if (value) {
          doc.text(`${key}: ${value}`, { align: 'right' });
        }
      });
    }

    doc.moveDown(1);
  }

  private addGroupHeader(doc: PDFKit.PDFDocument, group: GroupedProductData, y: number): number {
    doc.fontSize(14)
       .font(this.layout.fonts.header)
       .fillColor(this.layout.colors.primary)
       .text(`${group.groupName} (${group.totalCount} products)`, this.layout.margins.left, y);

    return y + 25;
  }

  private addTableHeader(doc: PDFKit.PDFDocument, config: PDFExportConfig, y: number): number {
    const visibleColumns = config.columns.filter(col => col.visible);
    let x = this.layout.margins.left;

    // Background for header
    doc.rect(this.layout.margins.left, y, 
             doc.page.width - this.layout.margins.left - this.layout.margins.right, 
             20)
       .fillColor('#f8fafc')
       .fill();

    doc.fontSize(9)
       .font(this.layout.fonts.header)
       .fillColor(this.layout.colors.text);

    visibleColumns.forEach(column => {
      doc.text(column.label, x + 5, y + 5, { width: column.width - 10, ellipsis: true });
      x += column.width;
    });

    return y + 25;
  }

  private async addProductRow(doc: PDFKit.PDFDocument, product: ProductForExport, config: PDFExportConfig, y: number): Promise<number> {
    const visibleColumns = config.columns.filter(col => col.visible);
    let x = this.layout.margins.left;
    const rowHeight = this.layout.spacing.rowHeight;

    // Alternating row background
    doc.rect(this.layout.margins.left, y, 
             doc.page.width - this.layout.margins.left - this.layout.margins.right, 
             rowHeight)
       .fillColor('#ffffff')
       .fill();

    doc.fontSize(8)
       .font(this.layout.fonts.body)
       .fillColor(this.layout.colors.text);

    for (const column of visibleColumns) {
      const cellValue = this.getCellValue(product, column.key);
      const cellY = y + 5;

      if (column.key === 'image' && config.includeImages) {
        // Add image placeholder or actual image
        await this.addProductImage(doc, product, x + 5, cellY);
      } else if (column.key === 'url') {
        // Add hyperlink
        doc.fillColor(this.layout.colors.primary)
           .text('Link', x + 5, cellY, { 
             width: column.width - 10, 
             link: product.url,
             underline: true 
           });
      } else {
        // Regular text
        doc.fillColor(this.layout.colors.text)
           .text(cellValue, x + 5, cellY, { 
             width: column.width - 10, 
             height: rowHeight - 10,
             ellipsis: true 
           });
      }

      x += column.width;
    }

    // Add border
    doc.strokeColor(this.layout.colors.border)
       .rect(this.layout.margins.left, y, 
             doc.page.width - this.layout.margins.left - this.layout.margins.right, 
             rowHeight)
       .stroke();

    return y + rowHeight;
  }

  private getCellValue(product: ProductForExport, columnKey: string): string {
    switch (columnKey) {
      case 'productName':
        return product.productName || '';
      case 'type':
        return product.type || '';
      case 'specificationDescription':
        return product.specificationDescription || '';
      case 'manufacturer':
        return product.manufacturer || '';
      case 'price':
        return product.price ? `$${product.price.toFixed(2)}` : '';
      case 'category':
        return product.category.join(', ');
      case 'location':
        return product.location.join(', ');
      case 'tagId':
        return product.tagId || '';
      case 'url':
        return 'Link';
      default:
        return '';
    }
  }

  private async addProductImage(doc: PDFKit.PDFDocument, product: ProductForExport, x: number, y: number): Promise<void> {
    try {
      // console.log(`🖼️ Loading image for product: ${product.productName}`);
      
      // Get the project state to access the asset manager
      const projectState = ProjectState.getInstance();
      const state = projectState.getStateInfo();
      
      if (!state.isOpen || !state.filePath) {
        this.addImagePlaceholder(doc, x, y);
        return;
      }

      // Get the project directory from the file path
      // The project directory is the .specbook file itself (it's actually a directory)
      const projectDir = state.filePath;
      
      // Initialize asset manager
      const assetManager = new AssetManager(projectDir);
      
      
      // Try multiple image sources in order of preference
      const imageSources = [
        { hash: product.primaryThumbnailHash, isThumbnail: true, name: 'thumbnail' },
        { hash: product.primaryImageHash, isThumbnail: false, name: 'primary image' }
      ].filter(source => source.hash); // Only include sources that have hashes

      if (imageSources.length === 0) {
        this.addImagePlaceholder(doc, x, y);
        return;
      }

      // Try each image source until we find one that works
      for (const source of imageSources) {
        try {
          const imagePath = await assetManager.getAssetPath(source.hash!, source.isThumbnail);
          
          // Check if file exists and is readable
          if (!fs.existsSync(imagePath)) {
            continue;
          }
          // Successfully found an image, embed it
          doc.image(imagePath, x, y, {
            width: this.layout.image.width,
            height: this.layout.image.height,
            fit: [this.layout.image.width, this.layout.image.height],
            align: 'center',
            valign: 'center'
          });
          return; // Success! Exit the function

        } catch (error) {
          continue; // Try the next source
        }
      }

      // If we get here, none of the image sources worked
      this.addImagePlaceholder(doc, x, y);

    } catch (error) {
      console.error('❌ Failed to load product image:', error);
      this.addImagePlaceholder(doc, x, y);
    }
  }

  private addImagePlaceholder(doc: PDFKit.PDFDocument, x: number, y: number): void {
    // Add placeholder rectangle
    doc.rect(x, y, this.layout.image.width, this.layout.image.height)
       .fillColor('#f3f4f6')
       .fill()
       .strokeColor(this.layout.colors.border)
       .stroke();

    // Add placeholder text
    doc.fontSize(6)
       .fillColor(this.layout.colors.secondary)
       .text('IMG', x + 15, y + 20);
  }

  private addDocumentFooter(doc: PDFKit.PDFDocument): void {
    const pages = doc.bufferedPageRange();
    
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      const footerY = doc.page.height - this.layout.margins.bottom + 10;
      
      doc.fontSize(8)
         .font(this.layout.fonts.small)
         .fillColor(this.layout.colors.secondary)
         .text(`Page ${i + 1} of ${pages.count}`, 
               this.layout.margins.left, 
               footerY, 
               { align: 'center', width: doc.page.width - this.layout.margins.left - this.layout.margins.right });
    }
  }

  private async savePDFToFile(doc: PDFKit.PDFDocument, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(outputPath);
      
      stream.on('error', reject);
      stream.on('finish', resolve);
      
      doc.pipe(stream);
      doc.end();
    });
  }
}
