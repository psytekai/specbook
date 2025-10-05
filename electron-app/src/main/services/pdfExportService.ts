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
import { logger } from '../../shared/logging/Logger';

const log = logger.for('PDFExportService');

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
          throw new Error(`Unsupported sortBy field: ${sortBy}`);
      }
    });
  }

  private async addCoverPage(doc: PDFKit.PDFDocument, config: PDFExportConfig): Promise<void> {
    log.info('🎨 Adding cover page to PDF');

    // Get project info from ProjectState
    const projectState = ProjectState.getInstance();
    const state = projectState.getStateInfo();

    log.info('Project state:', {
      hasProject: !!state.project,
      projectName: state.project?.name,
      filePath: state.filePath
    });

    if (!state.project) {
      log.warn('⚠️ No project info available for cover page - SKIPPING COVER PAGE');
      // Add a placeholder message on the first page
      doc.fontSize(16)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Cover Page Not Available', 100, 300, {
           width: doc.page.width - 200,
           align: 'center'
         });
      doc.fontSize(12)
         .text('No project information found', 100, 330, {
           width: doc.page.width - 200,
           align: 'center'
         });
      return;
    }

    const project = state.project;
    log.info('Cover page project info:', {
      name: project.name,
      subtitle: project.subtitle,
      hasPhoto: !!project.projectPhotoHash,
      hasLogo: !!project.companyLogoHash
    });
    const pageWidth = doc.page.width;
    const centerX = pageWidth / 2;

    let y = 100; // Start position from top

    // Project Name (Large, bold)
    doc.fontSize(28)
       .font('Helvetica-Bold')
       .fillColor(this.layout.colors.default)
       .text(project.name || 'Untitled Project', this.layout.margins.left, y, {
         width: pageWidth - this.layout.margins.left - this.layout.margins.right,
         align: 'center'
       });

    y += 40;

    // Project Subtitle
    if (project.subtitle) {
      doc.fontSize(16)
         .font('Helvetica')
         .fillColor(this.layout.colors.default)
         .text(project.subtitle, this.layout.margins.left, y, {
           width: pageWidth - this.layout.margins.left - this.layout.margins.right,
           align: 'center'
         });
      y += 30;
    }

    // Address Lines
    if (project.addressLine1) {
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor(this.layout.colors.default)
         .text(project.addressLine1, this.layout.margins.left, y, {
           width: pageWidth - this.layout.margins.left - this.layout.margins.right,
           align: 'center'
         });
      y += 15;
    }

    if (project.addressLine2) {
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor(this.layout.colors.default)
         .text(project.addressLine2, this.layout.margins.left, y, {
           width: pageWidth - this.layout.margins.left - this.layout.margins.right,
           align: 'center'
         });
      y += 40;
    } else if (project.addressLine1) {
      y += 20; // Add space even if no second line
    }

    // Project Photo (if available)
    if (project.projectPhotoHash && state.filePath) {
      try {
        const assetManager = new AssetManager(state.filePath);
        const photoPath = await assetManager.getAssetPath(project.projectPhotoHash, false);

        if (fs.existsSync(photoPath)) {
          const maxPhotoWidth = 400;
          const maxPhotoHeight = 285;

          doc.image(photoPath, centerX - maxPhotoWidth/2, y, {
            fit: [maxPhotoWidth, maxPhotoHeight],
            align: 'center'
          });
          y += maxPhotoHeight + 40;
        }
      } catch (error) {
        log.error('Failed to load project photo:', { error });
      }
    }

    // Company Logo (if available)
    if (project.companyLogoHash && state.filePath) {
      try {
        const assetManager = new AssetManager(state.filePath);
        const logoPath = await assetManager.getAssetPath(project.companyLogoHash, false);

        if (fs.existsSync(logoPath)) {
          const maxLogoWidth = 200;
          const maxLogoHeight = 65;

          doc.image(logoPath, centerX - maxLogoWidth/2, y, {
            fit: [maxLogoWidth, maxLogoHeight],
            align: 'center'
          });
          y += maxLogoHeight + 40;
        }
      } catch (error) {
        log.error('Failed to load company logo:', { error });
      }
    }

    // Issue Date and Issuance Name
    const issueDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const issuanceText = config.issuanceName
      ? `${issueDate} | ${config.issuanceName}`
      : issueDate;

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(this.layout.colors.default)
       .text(issuanceText, this.layout.margins.left, y, {
         width: pageWidth - this.layout.margins.left - this.layout.margins.right,
         align: 'center'
       });

    y += 25;

    // Created by info
    if (project.createdByName || project.createdByEmail) {
      const createdByText = project.createdByName && project.createdByEmail
        ? `Created by: ${project.createdByName}, ${project.createdByEmail}`
        : project.createdByName
          ? `Created by: ${project.createdByName}`
          : `Created by: ${project.createdByEmail}`;

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(this.layout.colors.default)
         .text(createdByText, this.layout.margins.left, y, {
           width: pageWidth - this.layout.margins.left - this.layout.margins.right,
           align: 'center'
         });
    }
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
      autoFirstPage: true, // PDFKit creates first page automatically
    });

    log.info('📄 Creating PDF document', { pageSize, landscape, groupCount: groupedData.length });

    // Add cover page on the first (auto-created) page
    await this.addCoverPage(doc, config);

    log.info('✅ Cover page added, adding new page for content');

    // Start content on a new page
    doc.addPage();
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

        // Check if we need a new page - but only if not the last item
        const isLastProduct = productIndex === group.products.length - 1;
        const isLastGroup = groupIndex === groupedData.length - 1;
        const needsSpace = currentY > doc.page.height - this.layout.spacing.rowHeight - this.layout.margins.bottom;

        if (needsSpace && !(isLastProduct && isLastGroup)) {
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
          `Processing ${product.tagId} ${product.type} ${product.manufacturer}...`,
          product.tagId
        );
      }

      currentY += this.layout.spacing.sectionGap;
    }

    // Add footer to all pages
    this.addDocumentFooter(doc);

    return doc;
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

    // Add vertical column separators
    x = this.layout.margins.left;
    for (let i = 0; i < config.columns.length - 1; i++) {
      x += config.columns[i].width;
      doc.strokeColor('#D9D9D9')
         .moveTo(x, y)
         .lineTo(x, y + 20)
         .stroke();
    }

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
        const imageX = x + (column.width - EXPORT_CONFIG.layout.image.maxWidth) / 2;
        const imageY = y + (rowHeight - EXPORT_CONFIG.layout.image.maxHeight) / 2;
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

    // Add vertical column separators
    x = this.layout.margins.left;
    for (let i = 0; i < config.columns.length - 1; i++) {
      x += config.columns[i].width;
      doc.strokeColor('#D9D9D9')
         .moveTo(x, y)
         .lineTo(x, y + rowHeight)
         .stroke();
    }

    return y + rowHeight;
  }

  private getCellValue(product: ProductForExport, columnKey: string): string {
    switch (columnKey) {
      case 'tagId':
        return product.tagId || '';
      case 'type':
        return product.type || '';
      case 'manufacturer':
        return product.manufacturer || '';
      case 'specificationDescription':
        return product.specificationDescription || '';
      case 'modelNo':
        return product.modelNo || '';
      case 'category':
        return product.category.join(', ');
      case 'location':
        return product.location.join(', ');
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

      try {
        const imagePath = await assetManager.getAssetPath(product.primaryImageHash!, false);

        // Check if file exists and is readable
        if (!fs.existsSync(imagePath)) {
          this.addImagePlaceholder(doc, x, y);
          return;
        }
        // Successfully found an image, embed it
        doc.image(imagePath, x, y, {
          fit: [EXPORT_CONFIG.layout.image.maxWidth, EXPORT_CONFIG.layout.image.maxHeight],
          align: EXPORT_CONFIG.layout.image.align,
          valign: EXPORT_CONFIG.layout.image.valign
        });

        return; // Success! Exit the function
      } catch (error) {
        this.addImagePlaceholder(doc, x, y);
        return;
      }

    } catch (error) {
      console.error('❌ Failed to load product image:', error);
      this.addImagePlaceholder(doc, x, y);
    }
  }

  private addImagePlaceholder(doc: PDFKit.PDFDocument, x: number, y: number): void {
    // Add placeholder rectangle
    doc.rect(x, y, EXPORT_CONFIG.layout.image.maxWidth, EXPORT_CONFIG.layout.image.maxHeight)
       .fillColor('#f3f4f6')
       .fill()
       .strokeColor(this.layout.colors.border)
       .stroke();

    // Add placeholder text
    doc.fontSize(EXPORT_CONFIG.layout.fonts.small)
       .fillColor(this.layout.colors.secondary)
       .text('IMG', x + EXPORT_CONFIG.layout.image.maxWidth/3, y + EXPORT_CONFIG.layout.image.maxHeight/2);
  }

  private addDocumentFooter(doc: PDFKit.PDFDocument): void {
    log.info('Adding document footer');

    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    log.info(`Adding footer to ${totalPages} pages`);

    // Total pages minus the cover page
    const totalContentPages = totalPages - 1;

    for (let i = 0; i < totalPages; i++) {
      try {
        // Skip footer on cover page (first page, i=0)
        if (i === 0) {
          log.info('Skipping footer on cover page');
          continue;
        }

        // Switch to page using the range start + offset
        doc.switchToPage(range.start + i);

        const footerY = doc.page.height - this.layout.margins.bottom + 10;

        log.info(`Page ${i}: height=${doc.page.height}, footerY=${footerY}`);

        // Save graphics state
        doc.save();

        // Add footer text
        doc.fontSize(8)
           .font(this.layout.fonts.small)
           .fillColor(this.layout.colors.secondary);

        // Page number: content pages start at 1 (i=1 becomes "Page 1")
        const pageNumber = i; // i=1 -> Page 1, i=2 -> Page 2, etc.
        const pageText = `Page ${pageNumber} of ${totalContentPages}`;
        const textWidth = doc.page.width - this.layout.margins.left - this.layout.margins.right;
        const textX = this.layout.margins.left + (textWidth / 2) - (doc.widthOfString(pageText) / 2);

        doc.text(pageText, textX, footerY, { lineBreak: false });

        // Restore graphics state
        doc.restore();

        log.info(`Successfully added footer to page ${i}`);
      } catch (error) {
        log.error(`Failed to add footer to page ${i}:`, { error });
      }
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
