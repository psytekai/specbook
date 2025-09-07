# Design: PDF Export - Clean Architecture & Reusable Patterns

## Problem Statement
Users need to export filtered, formatted specification documents for different audiences (builders, subcontractors, clients) with varying levels of detail and organization (by category, room, or complete project) - leveraging existing sophisticated filtering and grouping patterns already implemented in ProjectPage.

## Solution Approach
**Maximum Code Reuse Strategy**: Build PDF export as an extension of the existing ProjectPage patterns, reusing the sophisticated filtering, grouping, sorting, and column visibility logic already implemented. Apply clean architecture principles with clear separation between domain logic, application orchestration, and infrastructure concerns.

## Current Architecture Strengths to Leverage
✅ **Advanced filtering logic** (`filterProducts()`) - ready for audience-based content filtering  
✅ **Multiple grouping strategies** (`groupProductsByLocation/Category/Manufacturer`) - perfect for PDF view types  
✅ **Column visibility controls** (`visibleColumns` state) - ideal for field selection in PDFs  
✅ **Persistent user preferences** (localStorage patterns) - can extend for export configurations  
✅ **Clean TypeScript interfaces** - ready for PDF export type definitions  
✅ **Context-based state management** - can extend for export state  

## Clean Architecture Applied

### 1. Domain Layer (Business Logic)
```typescript
// Reuse and extend existing patterns from ProjectPage
interface ExportConfiguration {
  projectId: string;
  viewType: 'category' | 'room' | 'project';
  audience: 'client' | 'contractor' | 'builder';
  
  // Reuse ProjectPage filter structure
  filters: ProjectPageState['filters'];
  groupBy: ProjectPageState['groupBy']; 
  sortBy: ProjectPageState['sortBy'];
  visibleColumns: Partial<ProjectPageState['visibleColumns']>;
  
  // PDF-specific additions
  includeSecondaryItems: boolean;
  pageBreakStrategy: 'group' | 'none' | 'page-limit';
  branding?: BrandingConfig;
}

// Domain service that wraps existing ProjectPage logic
class ProductOrganizationService {
  // Direct reuse of ProjectPage functions
  filterProducts = filterProducts; // From ProjectPage
  sortProducts = sortProducts;     // From ProjectPage
  groupProductsByLocation = groupProductsByLocation; // From ProjectPage
  groupProductsByCategory = groupProductsByCategory; // From ProjectPage  
  groupProductsByManufacturer = groupProductsByManufacturer; // From ProjectPage
  
  organizeForExport(products: Product[], config: ExportConfiguration): ProductGroup[] {
    // Exact same logic as ProjectPage's organizedProducts calculation
    switch (config.groupBy) {
      case 'location': return this.groupProductsByLocation(products);
      case 'category': return this.groupProductsByCategory(products); 
      case 'manufacturer': return this.groupProductsByManufacturer(products);
      default: return { 'All Products': this.sortProducts(this.filterProducts(products)) };
    }
  }
  
  filterForAudience(products: Product[], audience: string): Product[] {
    // Audience-specific business rules built on top of existing filters
    const baseFiltered = this.filterProducts(products);
    
    switch (audience) {
      case 'client': 
        return baseFiltered.filter(p => !p.tagId.includes('INTERNAL'));
      case 'contractor':
        return baseFiltered; // Full access
      case 'builder':
        return baseFiltered.filter(p => p.category !== 'PRELIMINARY'); 
      default:
        return baseFiltered;
    }
  }
}
```

### 2. Application Layer (Orchestration)
```typescript
class ExportOrchestrator {
  constructor(
    private organizationService: ProductOrganizationService,
    private templateRenderer: TemplateRenderer,
    private pdfGenerator: PDFGenerator
  ) {}

  async generateExport(config: ExportConfiguration): Promise<ExportResult> {
    // 1. Get data using existing API patterns
    const products = await api.get<Product[]>(`/projects/${config.projectId}/products`);
    
    // 2. Apply business rules using existing logic
    const filteredProducts = this.organizationService.filterForAudience(products.data, config.audience);
    const organizedProducts = this.organizationService.organizeForExport(filteredProducts, config);
    
    // 3. Render template
    const template = await this.templateRenderer.getTemplate(config.viewType);
    const content = await this.templateRenderer.render(template, organizedProducts, config);
    
    // 4. Generate PDF
    return await this.pdfGenerator.generate(content, config);
  }
}
```

### 3. Infrastructure Layer (Implementation)
```typescript
// Template Strategy Pattern (aligns with view types from requirements)
interface TemplateRenderer {
  getTemplate(viewType: string): Promise<ExportTemplate>;
  render(template: ExportTemplate, data: ProductGroup[], config: ExportConfiguration): Promise<string>;
}

class HTMLTemplateRenderer implements TemplateRenderer {
  async render(template: ExportTemplate, data: ProductGroup[], config: ExportConfiguration): Promise<string> {
    // Generate HTML that matches existing ProjectPage styling for consistency
    return this.renderHTML(template, data, config);
  }
}

// PDF Generation Abstraction
interface PDFGenerator {
  generate(htmlContent: string, config: ExportConfiguration): Promise<ExportResult>;
}

class PuppeteerPDFGenerator implements PDFGenerator {
  async generate(htmlContent: string, config: ExportConfiguration): Promise<ExportResult> {
    // Puppeteer HTML-to-PDF for design consistency with web app
  }
}
```

### 4. Presentation Layer (UI Integration)
```typescript
// Extend existing ProjectPage UI patterns
interface ExportUIState extends Pick<ProjectPageState, 'filters' | 'groupBy' | 'sortBy' | 'visibleColumns'> {
  exportType: 'category' | 'room' | 'project';
  audience: 'client' | 'contractor' | 'builder';
  includeSecondaryItems: boolean;
}

// Reuse ProjectPage's localStorage persistence pattern
const EXPORT_STORAGE_KEY = 'export_preferences';
const getStoredExportState = (): Partial<ExportUIState> => {
  // Same validation pattern as ProjectPage's getStoredState()
};

// Export dialog component that mirrors ProjectPage controls
const ExportDialog: React.FC = () => {
  // Reuse ProjectPage state management patterns
  const [exportState, setExportState] = useState<ExportUIState>(() => ({
    ...getStoredExportState(),
    // Inherit current ProjectPage settings as defaults
    filters: currentFilters,
    groupBy: currentGroupBy,
    sortBy: currentSortBy,
    visibleColumns: currentVisibleColumns
  }));
};
```

## Refined Task Structure (Maximum Reuse)

### Core Components
1. **Export Configuration System** - Extends ProjectPage state patterns
2. **Product Organization Service** - Wraps existing ProjectPage functions  
3. **Template Strategy Implementation** - HTML templates matching ProjectPage styles
4. **PDF Generation Service** - Puppeteer for design consistency
5. **Export UI Integration** - Extends ProjectPage controls

### Implementation Strategy
**Phase 1: Zero Duplication Foundation**
- Extract ProjectPage filtering/grouping functions into shared utilities
- Create ExportConfiguration interface extending ProjectPageState
- Build ProductOrganizationService as wrapper around existing logic

**Phase 2: Template System**
- Create HTML templates that mirror ProjectPage's grid/list views
- Implement CategoryViewTemplate, RoomViewTemplate, ProjectViewTemplate
- Ensure visual consistency with existing web app styling

**Phase 3: PDF Generation**
- Implement Puppeteer-based PDF generator for HTML-to-PDF conversion
- Add export-specific styling (page breaks, print optimization)
- Create background job system for large projects

**Phase 4: UI Integration**  
- Add export button to ProjectPage header
- Create export dialog reusing ProjectPage filter/column controls
- Implement export history and preferences persistence

## Quality Attributes Achieved
✅ **DRY Principle**: Zero duplication of filtering/grouping logic  
✅ **Consistency**: PDFs visually match web app through shared templates  
✅ **Maintainability**: Changes to ProjectPage filtering automatically benefit export  
✅ **Testability**: Existing ProjectPage logic already tested, minimal new test surface  
✅ **User Experience**: Familiar controls, settings inherited from current view  
✅ **Extensibility**: Template strategy allows new export formats  

## Integration Points (Reuse Existing Patterns)
- **Data Access**: Use existing `api.get()` patterns
- **State Management**: Extend existing ProjectContext if needed
- **Persistence**: Follow existing localStorage patterns from ProjectPage
- **Type Safety**: Extend existing TypeScript interfaces  
- **Error Handling**: Use existing error patterns from api.ts

## Unknowns Requiring Investigation
- **Performance threshold**: How many products before background processing needed?
- **Image optimization**: Best strategy for embedding product images in PDFs
- **Template complexity**: Advanced PDF features (TOC, internal links) vs simple layouts
- **Print quality**: DPI and sizing requirements for professional documents

## Strategic Decisions
1. **HTML-to-PDF over native PDF libraries** - Maintains visual consistency with web app
2. **Wrapper pattern over refactoring** - Preserves existing ProjectPage functionality  
3. **Configuration inheritance** - Export dialogs start with current ProjectPage settings
4. **Template strategy** - Separate templates for different use cases vs single configurable template

## Next Steps
```bash
# 1. Extract shared utilities (no breaking changes)
mkdir electron-app/src/renderer/utils/product-organization
# Move ProjectPage functions to shared location

# 2. Create export domain layer
mkdir electron-app/src/renderer/services/export
# Implement ExportConfiguration, ProductOrganizationService

# 3. Implement template system
mkdir electron-app/src/renderer/templates/export
# Create HTML templates with ProjectPage styling

# 4. Add PDF generation
npm install puppeteer @types/puppeteer
# Implement PuppeteerPDFGenerator

# 5. Integrate with ProjectPage UI
# Add export button and dialog to existing ProjectPage
```

This design achieves maximum code reuse while applying clean architecture principles, ensuring the PDF export system is maintainable, testable, and consistent with existing patterns.