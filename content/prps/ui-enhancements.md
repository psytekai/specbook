# PRP: UI Enhancements for Specbook Manager

## Overview

This PRP implements comprehensive UI enhancements for the Specbook Manager Electron desktop application, adding 11 major features including image upload, data fields expansion, enhanced table functionality, and editable product details. The implementation follows existing patterns in the React 19.1 + TypeScript codebase.

## Context & Architecture

### Current Tech Stack
- **Frontend**: React 19.1.0, TypeScript, Vite, React Router v6
- **Desktop**: Electron 37.2.4
- **Styling**: CSS Modules (see existing `.css` files)
- **State**: React Context + useState patterns
- **API**: Mock API pattern with filesystem storage

### Existing Patterns to Follow

#### 1. Data Models (electron-app/src/renderer/types/index.ts)
```typescript
// Current Product interface - needs extension
export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId: string;
  location: string;      // Convert to string[] for multi-select
  image: string;
  images: string[];
  description: string;
  specificationDescription: string;
  category: string;       // Convert to category ID reference
  createdAt: Date;
}
```

#### 2. API Patterns (electron-app/src/renderer/services/api.ts)
```typescript
// Existing location management pattern to copy for categories
export const fetchProductLocations = async (): Promise<string[]> => { /* mock implementation */ }
export const addProductLocation = async (location: string): Promise<{ success: boolean }> => { /* mock implementation */ }
```

#### 3. Dropdown with Add Pattern (ProductNew.tsx lines 217-273)
```typescript
// Reuse this exact pattern for category dropdown
{!showAddLocation ? (
  <div className="location-dropdown-wrapper">
    <select /* existing pattern */ />
    <button onClick={() => setShowAddLocation(true)}>Add New</button>
  </div>
) : (
  <div className="add-location-wrapper">
    <input /* add new input */ />
    <button onClick={handleAddLocation}>Add</button>
    <button onClick={() => setShowAddLocation(false)}>Cancel</button>
  </div>
)}
```

## Implementation Blueprint

### Phase 1: Foundation (Data & Quick Wins)
**Dependencies**: None
**Estimated Effort**: 2-3 days

#### Task 1.1: Update Data Models
```typescript
// electron-app/src/renderer/types/index.ts
export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId: string;
  location: string[];           // CHANGED: multi-select
  image: string;
  images: string[];
  description: string;
  specificationDescription: string;
  category: string;
  product_name?: string;        // NEW
  manufacturer?: string;        // NEW  
  price?: number;              // NEW
  custom_image_url?: string;   // NEW
  createdAt: Date;
}

// Add new request/response types
export interface FetchProductDetailsResponse {
  product_image: string;
  product_images: string[];
  product_description: string;
  specification_description: string;
  category: string;
  product_name?: string;        // NEW
  manufacturer?: string;        // NEW
  price?: number;              // NEW
}
```

#### Task 1.2: Create Utility Functions
```typescript
// electron-app/src/renderer/utils/formatters.ts (NEW FILE)
export const formatPrice = (price: number | undefined): string => {
  if (!price) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(price);
};

export const truncateString = (str: string, maxLength: number): string => {
  return str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;
};
```

#### Task 1.3: Fix Product Title (Subtask 5)
```typescript
// electron-app/src/renderer/pages/ProductPage.tsx line 98
// CHANGE FROM:
<h1>{product.description}</h1>
// CHANGE TO:
<h1>{product.product_name || product.description || "Untitled Product"}</h1>
```

### Phase 2: Enhanced Input Components
**Dependencies**: Phase 1 data models
**Estimated Effort**: 3-4 days

#### Task 2.1: Create FileUpload Component
**Library**: Use native File API (no external deps needed for Electron)

```typescript
// electron-app/src/renderer/components/FileUpload/FileUpload.tsx (NEW FILE)
interface FileUploadProps {
  onFileSelected: (file: File) => void;
  accept: string;
  maxSize: number;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelected, accept, maxSize, className }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  
  const validateFile = (file: File): boolean => {
    if (file.size > maxSize) {
      throw new Error(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
    }
    return true;
  };
  
  // Implementation with drag/drop handlers
};
```

#### Task 2.2: Create CategoryDropdown Component
**Pattern**: Copy exact pattern from ProductNew.tsx location dropdown

```typescript
// electron-app/src/renderer/components/CategoryDropdown/CategoryDropdown.tsx (NEW FILE)
// Copy location dropdown pattern from ProductNew.tsx lines 217-273
// Add categories API pattern similar to locations
```

#### Task 2.3: Create LocationMultiSelect Component  
**Library**: Consider react-select for multi-select, or implement custom solution

```typescript
// electron-app/src/renderer/components/LocationMultiSelect/LocationMultiSelect.tsx (NEW FILE)
interface LocationMultiSelectProps {
  selectedLocations: string[];
  onSelectionChange: (locations: string[]) => void;
  availableLocations: string[];
  onAddLocation: (location: string) => void;
}
```

### Phase 3: Table Enhancements
**Dependencies**: Phase 1 data models, new product fields
**Estimated Effort**: 4-5 days

#### Task 3.1: Add New Table Columns
```typescript
// electron-app/src/renderer/pages/ProjectPage.tsx lines 348-357
// ADD new table headers:
<th>Product Name</th>
<th>Manufacturer</th>
<th>Price</th>
// UPDATE corresponding table cells in lines 360-410
```

#### Task 3.2: Implement Table Sorting
**Library**: Lightweight custom solution or TanStack Table v8
**Reference**: https://tanstack.com/table/v8/docs/guide/sorting

```typescript
// Add to ProjectPage.tsx
const [sortConfig, setSortConfig] = useState<{column: string, direction: 'asc' | 'desc'} | null>(null);

const sortProducts = (products: Product[], column: string, direction: 'asc' | 'desc') => {
  return [...products].sort((a, b) => {
    let aValue = a[column as keyof Product];
    let bValue = b[column as keyof Product];
    
    // Handle different data types
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    // Add number, date sorting logic
  });
};
```

#### Task 3.3: Implement Column Visibility
```typescript
// Add to ProjectPage.tsx
const [visibleColumns, setVisibleColumns] = useState<string[]>([
  'image', 'product_name', 'manufacturer', 'price', 'category', 'location', 'actions'
]);

// Save to localStorage pattern exists in lines 16-55
```

#### Task 3.4: Implement Filtering
```typescript
// Add filter state and logic
const [filters, setFilters] = useState<Record<string, string>>({});

const applyFilters = (products: Product[]) => {
  return products.filter(product => {
    return Object.entries(filters).every(([column, value]) => {
      if (!value) return true;
      const productValue = product[column as keyof Product]?.toString().toLowerCase() || '';
      return productValue.includes(value.toLowerCase());
    });
  });
};
```

### Phase 4: Enhanced Grouping
**Dependencies**: Phase 1 data models, Phase 3 table structure
**Estimated Effort**: 2-3 days

#### Task 4.1: Extend Group-By Options
```typescript
// electron-app/src/renderer/pages/ProjectPage.tsx lines 220-227
// EXTEND groupBy type and options:
type GroupByOption = 'none' | 'location' | 'category' | 'manufacturer';

// ADD new options to dropdown:
<option value="category">Category</option>
<option value="manufacturer">Manufacturer</option>
```

#### Task 4.2: Handle Multi-Location Grouping
```typescript
// Modify groupProductsByLocation function (lines 112-131) to handle arrays
const groupProducts = (products: Product[], groupBy: string) => {
  if (groupBy === 'location') {
    // Special handling for location arrays - duplicate products across groups
    const grouped: Record<string, Product[]> = {};
    products.forEach(product => {
      const locations = Array.isArray(product.location) ? product.location : [product.location];
      locations.forEach(loc => {
        if (!grouped[loc]) grouped[loc] = [];
        grouped[loc].push(product);
      });
    });
    return grouped;
  }
  // Standard grouping for other fields
};
```

### Phase 5: Editable Product Details
**Dependencies**: Phases 1-2 components
**Estimated Effort**: 4-5 days

#### Task 5.1: Create EditableSection Component
```typescript
// electron-app/src/renderer/components/EditableSection/EditableSection.tsx (NEW FILE)
interface EditableSectionProps {
  title: string;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

export const EditableSection: React.FC<EditableSectionProps> = ({ title, isEditing, onToggleEdit, onSave, onCancel, children }) => {
  return (
    <div className="detail-section">
      <div className="section-header">
        <h2>{title}</h2>
        {!isEditing ? (
          <button className="edit-button" onClick={onToggleEdit}>
            <PencilIcon />
          </button>
        ) : (
          <div className="edit-actions">
            <button className="button button-primary" onClick={onSave}>Save</button>
            <button className="button button-secondary" onClick={onCancel}>Cancel</button>
          </div>
        )}
      </div>
      {children}
    </div>
  );
};
```

#### Task 5.2: Update ProductPage with Edit Functionality
```typescript
// electron-app/src/renderer/pages/ProductPage.tsx
// Add edit state management:
const [editSections, setEditSections] = useState<Record<string, boolean>>({});
const [editValues, setEditValues] = useState<Partial<Product>>({});

// Wrap existing sections with EditableSection component
```

### Phase 6: Image Management
**Dependencies**: Phase 1 FileUpload component, Phase 5 ProductPage editing
**Estimated Effort**: 3-4 days

#### Task 6.1: Add Image Upload to ProductNew
```typescript
// electron-app/src/renderer/pages/ProductNew.tsx
// Add after product fetch (line 284), before save section:
{hasDetails && (
  <div className="image-upload-section">
    <h3>Custom Image</h3>
    <FileUpload 
      onFileSelected={handleCustomImageUpload}
      accept=".jpg,.jpeg,.png,.webp"
      maxSize={5 * 1024 * 1024}
    />
    {customImagePreview && (
      <div className="image-preview">
        <img src={customImagePreview} alt="Custom upload preview" />
        <button onClick={() => setCustomImagePreview(null)}>Remove</button>
      </div>
    )}
  </div>
)}
```

#### Task 6.2: Add Image Management to ProductPage
```typescript
// electron-app/src/renderer/pages/ProductPage.tsx
// Wrap image sections (lines 119-142) with hover overlays and upload functionality
```

#### Task 6.3: Create MockImageService
```typescript
// electron-app/src/renderer/services/imageService.ts (NEW FILE)
export interface ImageService {
  uploadImage(file: File): Promise<{ url: string; id: string }>;
  deleteImage(id: string): Promise<{ success: boolean }>;
}

export class MockImageService implements ImageService {
  async uploadImage(file: File): Promise<{ url: string; id: string }> {
    // Create blob URL for preview, save to mock filesystem
    const url = URL.createObjectURL(file);
    const id = Date.now().toString();
    return { url, id };
  }
  
  async deleteImage(id: string): Promise<{ success: boolean }> {
    // Mock deletion
    return { success: true };
  }
}
```

## External Documentation References

### React 19 Best Practices
- **Hook Rules**: https://react.dev/reference/rules/rules-of-hooks
- **State Management**: Use useState for local state, Context for shared state
- **Performance**: Use useMemo for expensive calculations, useCallback for stable references

### Recommended Libraries
- **File Upload**: Native File API sufficient for Electron (no external library needed)
- **Multi-Select**: react-select v5.10.2 https://react-select.com/home
- **Table Features**: TanStack Table v8 https://tanstack.com/table/v8 (optional, can implement custom)
- **Form Validation**: react-hook-form + zod for complex forms (optional for this scope)

### TypeScript Integration
- **Type Safety**: Maintain strict TypeScript throughout
- **Interface Extensions**: Extend existing interfaces rather than replacing
- **Generic Components**: Use generic types for reusable components

## Validation Gates

### Phase 1 Validation
```bash
# Type checking
cd electron-app && npm run type-check

# Linting  
cd electron-app && npm run lint

# Build test
cd electron-app && npm run build

# Manual test: Product title displays product_name with fallback
```

### Phase 2 Validation  
```bash
# Component compilation
cd electron-app && npm run type-check

# Manual tests:
# - File upload accepts JPG/PNG/WebP, rejects others
# - File upload rejects files > 5MB
# - Category dropdown shows options and allows adding new
# - Location multi-select allows multiple selections
```

### Phase 3 Validation
```bash
# Table functionality tests
cd electron-app && npm run build

# Manual tests:  
# - New columns display in table
# - Sorting works on all columns (except Image/Actions)
# - Column visibility toggles work
# - Filters reduce displayed results
# - Preferences persist in localStorage
```

### Phase 4 Validation
```bash
# Grouping tests
cd electron-app && npm run type-check

# Manual tests:
# - Group by category/manufacturer works
# - Multi-location products appear in multiple groups
# - Group counts are accurate
```

### Phase 5 Validation
```bash
# Edit functionality tests  
cd electron-app && npm run build

# Manual tests:
# - Pencil icons appear on sections
# - Edit mode shows form fields
# - Save/Cancel work correctly
# - Components reuse existing dropdowns
# - Optimistic updates with rollback on error
```

### Phase 6 Validation
```bash
# Image management tests
cd electron-app && npm run build

# Manual tests:
# - Image upload works in ProductNew flow
# - Hover shows delete buttons on ProductPage
# - Upload icons work for main/additional images
# - Changes stage until Save is clicked
# - Mock filesystem storage works
```

## Implementation Order

Execute in exact order due to dependencies:

1. **Phase 1**: Data models, utilities, title fix
2. **Phase 2**: Input components (FileUpload, CategoryDropdown, LocationMultiSelect) 
3. **Phase 3**: Table enhancements (columns, sorting, filtering, visibility)
4. **Phase 4**: Enhanced grouping (depends on new data fields)
5. **Phase 5**: Editable sections (depends on input components)
6. **Phase 6**: Image management (depends on FileUpload + editable sections)

## Error Handling Strategy

### File Upload Errors
```typescript
const handleFileError = (error: Error) => {
  if (error.message.includes('size')) {
    showToast('File too large. Maximum size is 5MB.', 'error');
  } else if (error.message.includes('type')) {
    showToast('Invalid file type. Please use JPG, PNG, or WebP.', 'error');
  } else {
    showToast('Upload failed. Please try again.', 'error');
  }
};
```

### API Error Patterns
```typescript
// Follow existing pattern from api.ts handleApiError function
// Use existing toast system from useToast hook
```

### State Management Errors
```typescript
// Implement optimistic updates with rollback
const handleSave = async () => {
  const previousState = { ...product };
  try {
    // Update UI immediately
    setProduct(newProduct);
    // Call API
    await updateProduct(newProduct);
  } catch (error) {
    // Rollback on error
    setProduct(previousState);
    showToast('Save failed. Changes reverted.', 'error');
  }
};
```

## Code Patterns to Follow

### Component Structure
```typescript
// Follow existing pattern from ProductNew.tsx, ProductPage.tsx, ProjectPage.tsx
// Use functional components with hooks
// CSS Modules for styling (separate .css files)
// Props interfaces in TypeScript
```

### State Management
```typescript
// Use useState for local component state
// Use useEffect for side effects
// Use Context for shared state (follow ProjectContext pattern)
// Save preferences to localStorage (follow existing pattern in ProjectPage)
```

### API Calls
```typescript
// Follow async/await pattern from existing API service
// Use try/catch with proper error handling
// Show loading states during API calls
// Use toast notifications for feedback
```

## Testing Strategy

### Manual Testing Approach
1. **Feature Testing**: Test each feature individually after implementation
2. **Integration Testing**: Test feature combinations (e.g., edit + save)
3. **Edge Cases**: Test with empty data, null values, large datasets
4. **Browser Compatibility**: Test in Electron's Chromium environment
5. **Performance**: Test with 100+ products in table

### Automated Testing (Future)
- Unit tests for utility functions
- Component tests for complex components
- Integration tests for API patterns
- E2E tests for critical user flows

## Success Criteria

### Functional Requirements Met
- ✅ All 11 subtasks implemented according to specifications
- ✅ Existing functionality preserved and enhanced
- ✅ Type safety maintained throughout
- ✅ Performance acceptable with realistic data volumes

### Quality Standards Met  
- ✅ Code follows existing patterns and conventions
- ✅ Error handling comprehensive and user-friendly
- ✅ All validation gates pass
- ✅ No TypeScript errors or linting violations
- ✅ Responsive design works across screen sizes

## Confidence Score: 9/10

**High confidence due to:**
- Comprehensive codebase analysis with existing patterns identified
- Clear implementation blueprint with specific file references
- Proven external library recommendations with documentation links
- Detailed validation gates ensuring quality
- Phased approach handling all dependencies
- Error handling strategy covering edge cases

**Risk factors:**
- Complex table functionality may require iteration
- Multi-location grouping logic needs careful testing
- Image management mock implementation needs future API migration planning