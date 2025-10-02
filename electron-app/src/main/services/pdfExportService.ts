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
} from '../../shared/types/exportTypes';
import { EXPORT_CONFIG, DEFAULT_PDF_LAYOUT } from '../../shared/config/exportConfig';

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

  private toTitleCase(text: string): string {
    return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
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
        const normalizedKey = this.toTitleCase(groupKey);
        if (!groups.has(normalizedKey)) {
          groups.set(normalizedKey, []);
        }
        groups.get(normalizedKey)!.push(product);
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

    // Sort groups with 'uncategorized' and 'no location' at the top, then alphabetically
    sortedGroups.sort((a, b) => {
      const aIsSpecial = a.groupName.toLowerCase() === 'uncategorized' || a.groupName.toLowerCase() === 'no location';
      const bIsSpecial = b.groupName.toLowerCase() === 'uncategorized' || b.groupName.toLowerCase() === 'no location';
      
      // If one is special and the other isn't, special group comes first
      if (aIsSpecial && !bIsSpecial) return -1;
      if (!aIsSpecial && bIsSpecial) return 1;
      
      // If both are special or both are regular, sort alphabetically
      return a.groupName.localeCompare(b.groupName);
    });

    return sortedGroups;
  }

  private sortProducts(products: ProductForExport[], sortBy: PDFExportConfig['sortBy']): ProductForExport[] {
    return [...products].sort((a, b) => {
      switch (sortBy) {
        case 'tagId': // We should only and always sort by tag ids
          return a.tagId?.localeCompare(b.tagId? b.tagId : '') || 0;
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
    this.addDocumentHeader(doc, config);

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

  private addDocumentHeader(doc: PDFKit.PDFDocument, config: PDFExportConfig): void {
    // Title
    doc.fontSize(EXPORT_CONFIG.layout.fonts.title)
       .font(this.layout.fonts.header)
       .fillColor(this.layout.colors.primary)
       .text('Product Export Report', this.layout.margins.left, this.layout.margins.top);

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
       .text(`${group.groupName}`, this.layout.margins.left, y);

    return y + 25;
  }

  private addTableHeader(doc: PDFKit.PDFDocument, config: PDFExportConfig, y: number): number {
    let x = this.layout.margins.left;

    // Background for header
    doc.rect(this.layout.margins.left, y, 
             doc.page.width - this.layout.margins.left - this.layout.margins.right, 
             20)
       .fillColor('#f8fafc')
       .fill();

    doc.fontSize(EXPORT_CONFIG.layout.fonts.header)
       .font(this.layout.fonts.header)
       .fillColor(this.layout.colors.text);

    config.columns.forEach(column => {
      doc.text(column.label, x + 5, y + 5, { width: column.width - 10, ellipsis: true });
      x += column.width;
    });

    return y + 25;
  }

  private async addProductRow(doc: PDFKit.PDFDocument, product: ProductForExport, config: PDFExportConfig, y: number): Promise<number> {
    let x = this.layout.margins.left;
    const rowHeight = EXPORT_CONFIG.layout.spacing.rowHeight;

    // Alternating row background
    doc.rect(this.layout.margins.left, y, 
             doc.page.width - this.layout.margins.left - this.layout.margins.right, 
             rowHeight)
       .fillColor('#ffffff')
       .fill();

    doc.fontSize(EXPORT_CONFIG.layout.fonts.body)
       .font(this.layout.fonts.body)
       .fillColor(this.layout.colors.text);

    for (const column of config.columns) {
      const cellValue = this.getCellValue(product, column.key);
      const cellY = y + 5;

      if (column.key === 'image' && config.includeImages) {
        // Add image placeholder or actual image - center it in the cell
        const imageX = x + (column.width - EXPORT_CONFIG.layout.image.width) / 2;
        const imageY = y + (rowHeight - EXPORT_CONFIG.layout.image.height) / 2;
        await this.addProductImage(doc, product, imageX, imageY);
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
            width: EXPORT_CONFIG.layout.image.width,
            height: EXPORT_CONFIG.layout.image.height,
            fit: [EXPORT_CONFIG.layout.image.width, EXPORT_CONFIG.layout.image.height],
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
    doc.rect(x, y, EXPORT_CONFIG.layout.image.width, EXPORT_CONFIG.layout.image.height)
       .fillColor('#f3f4f6')
       .fill()
       .strokeColor(this.layout.colors.border)
       .stroke();

    // Add placeholder text
    doc.fontSize(EXPORT_CONFIG.layout.fonts.small)
       .fillColor(this.layout.colors.secondary)
       .text('IMG', x + EXPORT_CONFIG.layout.image.width/3, y + EXPORT_CONFIG.layout.image.height/2);
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
