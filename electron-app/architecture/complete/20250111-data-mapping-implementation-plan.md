# Data Mapping Implementation Plan

**Date:** 2025-01-11  
**Status:** Ready for Implementation  
**Review Process:** Step-by-step with verification after each phase

## Overview

This document provides a detailed, step-by-step implementation plan to resolve the critical data mapping issues identified in the analysis report. Each step includes specific code changes, file modifications, and verification procedures.

## Implementation Steps

### Step 0: Fix Database Schema Consistency (GREENFIELD)
**Priority:** Critical - Database foundation  
**Risk:** Low - Fresh start, no data loss  
**Time Estimate:** 30 minutes

Since you're starting from greenfield (wiping all data), we can fix the database schema to use consistent snake_case naming throughout.

#### 0.1 Current Schema Issues

**Problems Identified:**
- `products` table mixes camelCase (`projectId`, `tagId`, `createdAt`, `updatedAt`, `specificationDescription`) with snake_case (`product_name`, `primary_image_hash`)
- `categories` and `locations` tables use camelCase (`createdAt`)  
- `assets` table correctly uses snake_case (good!)

#### 0.2 Fix Products Table Schema

**File:** `electron-app/src/main/services/ProjectFileManager.ts`

**Update the products table creation (lines 71-88):**
```sql
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,           -- camelCase -> snake_case
  url TEXT NOT NULL,
  tag_id TEXT,                        -- camelCase -> snake_case
  location TEXT,                      -- JSON string
  description TEXT,
  specification_description TEXT,     -- camelCase -> snake_case
  category TEXT,                      -- JSON string
  product_name TEXT,
  manufacturer TEXT,
  price REAL,
  primary_image_hash TEXT,
  primary_thumbnail_hash TEXT,
  additional_images_hashes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- camelCase -> snake_case
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP   -- camelCase -> snake_case
)
```

#### 0.3 Fix Categories Table Schema

**Update categories table (lines 94-98):**
```sql
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP   -- camelCase -> snake_case
)
```

#### 0.4 Fix Locations Table Schema  

**Update locations table (lines 103-107):**
```sql
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP   -- camelCase -> snake_case
)
```

#### 0.5 Update Trigger Reference

**Update the trigger (around line 112):**
```sql
CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
AFTER UPDATE ON products
BEGIN
  UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;  -- camelCase -> snake_case
END
```

#### 0.6 Verification Steps

**Verification Checklist:**
- [ ] All database columns use snake_case consistently
- [ ] Assets table remains unchanged (already correct)
- [ ] Trigger references correct column name
- [ ] Database creation succeeds without errors

**Test Commands:**
```bash
cd electron-app
npm run dev
# Check app starts and database creates successfully
```

**Manual Verification:**
1. Start the app to trigger database creation
2. Check the database file is created successfully
3. Use SQLite browser to verify schema matches expected snake_case format
4. Confirm no error messages in console

---

### Step 1: Create Shared Field Mapping Utilities
**Priority:** Critical - Foundation for all other fixes  
**Risk:** Low - New code, no breaking changes  
**Time Estimate:** 30 minutes

#### 1.1 Create Field Mapping Utilities

**New File:** `electron-app/src/shared/mappings/fieldMappings.ts`

```typescript
// Database column names to TypeScript interface field names
export const DB_TO_INTERFACE_MAPPING = {
  // Asset management fields (snake_case -> camelCase)
  'primary_image_hash': 'primaryImageHash',
  'primary_thumbnail_hash': 'primaryThumbnailHash', 
  'additional_images_hashes': 'additionalImagesHashes',
  
  // Core fields (snake_case -> camelCase)
  'project_id': 'projectId',
  'tag_id': 'tagId',
  'specification_description': 'specificationDescription',
  'created_at': 'createdAt',
  'updated_at': 'updatedAt',
  
  // Fields that stay the same
  'id': 'id',
  'url': 'url',
  'location': 'location',
  'description': 'description', 
  'category': 'category',
  'product_name': 'product_name',
  'manufacturer': 'manufacturer',
  'price': 'price'
} as const;

// Reverse mapping for updates
export const INTERFACE_TO_DB_MAPPING = Object.fromEntries(
  Object.entries(DB_TO_INTERFACE_MAPPING).map(([k, v]) => [v, k])
) as Record<string, string>;

// Type-safe field transformer
export function mapDbRowToInterface<T extends Record<string, any>>(
  dbRow: T
): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [dbField, value] of Object.entries(dbRow)) {
    const interfaceField = DB_TO_INTERFACE_MAPPING[dbField as keyof typeof DB_TO_INTERFACE_MAPPING] || dbField;
    result[interfaceField] = value;
  }
  
  return result;
}

export function mapInterfaceToDb<T extends Record<string, any>>(
  interfaceObj: T
): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [interfaceField, value] of Object.entries(interfaceObj)) {
    const dbField = INTERFACE_TO_DB_MAPPING[interfaceField] || interfaceField;
    result[dbField] = value;
  }
  
  return result;
}
```

#### 1.2 Create API Field Mapping Utilities

**New File:** `electron-app/src/shared/mappings/apiFieldMappings.ts`

```typescript
// API field names to internal TypeScript interface field names
export const API_TO_INTERNAL_MAPPING = {
  // URL and identification
  'product_url': 'url',
  'tag_id': 'tagId',
  'project_id': 'projectId',
  
  // Content fields
  'product_location': 'location',
  'product_description': 'description',
  'specification_description': 'specificationDescription',
  'product_name': 'product_name',
  
  // Asset management fields (corrected)
  'primary_image_hash': 'primaryImageHash',
  'primary_thumbnail_hash': 'primaryThumbnailHash',
  'additional_images_hashes': 'additionalImagesHashes',
  
  // Legacy/deprecated fields
  'custom_image_url': null,     // Deprecated
  'product_image': null,         // Deprecated
  'product_images': null,        // Deprecated
  'image_hash': 'primaryImageHash',     // Legacy redirect
  'thumbnail_hash': 'primaryThumbnailHash', // Legacy redirect
  'images_hashes': 'additionalImagesHashes' // Legacy redirect
} as const;

export function transformApiToInternal(apiData: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [apiField, value] of Object.entries(apiData)) {
    const mapping = API_TO_INTERNAL_MAPPING[apiField as keyof typeof API_TO_INTERNAL_MAPPING];
    
    if (mapping === null) {
      console.warn(`Deprecated API field ignored: ${apiField}`);
      continue;
    }
    
    const internalField = mapping || apiField;
    result[internalField] = value;
  }
  
  return result;
}

export function transformInternalToApi(internalData: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  // Reverse mapping for API responses
  const reverseMapping: Record<string, string> = {
    'url': 'product_url',
    'tagId': 'tag_id',
    'projectId': 'project_id',
    'location': 'product_location',
    'description': 'product_description',
    'specificationDescription': 'specification_description',
    'primaryImageHash': 'primary_image_hash',
    'primaryThumbnailHash': 'primary_thumbnail_hash',
    'additionalImagesHashes': 'additional_images_hashes'
  };
  
  for (const [internalField, value] of Object.entries(internalData)) {
    const apiField = reverseMapping[internalField] || internalField;
    result[apiField] = value;
  }
  
  return result;
}
```

#### 1.3 Verification Steps

**Verification Checklist:**
- [ ] Both new files created successfully
- [ ] No TypeScript compilation errors
- [ ] Mappings are bijective (one-to-one, reversible)
- [ ] All database fields have corresponding interface fields
- [ ] Legacy field handling includes console warnings

**Test Commands:**
```bash
cd electron-app
npm run type-check
```

**Manual Verification:**
1. Open the files and verify all mappings are present
2. Check that snake_case fields map to camelCase correctly
3. Verify deprecated fields are marked as null

---

### Step 2: Update ProjectFileManager to Use Field Mappings
**Priority:** Critical - Core data layer  
**Risk:** Medium - Modifies existing database operations  
**Time Estimate:** 45 minutes

#### 2.1 Update Import Statements

**File:** `electron-app/src/main/services/ProjectFileManager.ts`

Add imports at the top:
```typescript
import { mapDbRowToInterface, mapInterfaceToDb } from '../../shared/mappings/fieldMappings';
```

#### 2.2 Update parseProductRow Method

**Current Code (lines 703-723):**
```typescript
private parseProductRow(row: any): Product {
  return {
    id: row.id,
    projectId: row.projectId,
    // ... rest of fields
  };
}
```

**New Code:**
```typescript
private parseProductRow(row: any): Product {
  // First apply field name mappings
  const mappedRow = mapDbRowToInterface(row);
  
  // Then parse JSON fields and ensure correct types
  return {
    id: mappedRow.id,
    projectId: mappedRow.projectId,
    url: mappedRow.url,
    tagId: mappedRow.tagId || undefined,
    location: this.parseJsonArray(mappedRow.location),
    description: mappedRow.description || undefined,
    specificationDescription: mappedRow.specificationDescription || undefined,
    category: this.parseJsonArray(mappedRow.category),
    product_name: mappedRow.product_name,
    manufacturer: mappedRow.manufacturer || undefined,
    price: mappedRow.price || undefined,
    
    // Asset fields now properly mapped from snake_case
    primaryImageHash: mappedRow.primaryImageHash || undefined,
    primaryThumbnailHash: mappedRow.primaryThumbnailHash || undefined,
    additionalImagesHashes: this.parseJsonArray(mappedRow.additionalImagesHashes),
    
    createdAt: new Date(mappedRow.createdAt),
    updatedAt: new Date(mappedRow.updatedAt)
  };
}

private parseJsonArray(jsonField: string | null | undefined): string[] {
  if (!jsonField) return [];
  try {
    const parsed = JSON.parse(jsonField);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error('Failed to parse JSON array:', jsonField, error);
    return [];
  }
}
```

#### 2.3 Update createProduct Method

**Update the INSERT statement preparation (around lines 319-328):**
```typescript
async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const db = await this.getDatabase();
  const id = this.generateId();
  const now = new Date().toISOString();
  
  // Map interface fields to database column names
  const dbData = mapInterfaceToDb({
    ...productData,
    id,
    createdAt: now,
    updatedAt: now
  });
  
  const stmt = db.prepare(`
    INSERT INTO products (
      id, projectId, url, tagId, location, description,
      specificationDescription, category, product_name,
      manufacturer, price, primary_image_hash,
      primary_thumbnail_hash, additional_images_hashes,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    dbData.id,
    dbData.projectId,
    dbData.url,
    dbData.tagId || null,
    JSON.stringify(productData.location || []),
    dbData.description || null,
    dbData.specificationDescription || null,
    JSON.stringify(productData.category || []),
    dbData.product_name,
    dbData.manufacturer || null,
    dbData.price || null,
    dbData.primary_image_hash || null,
    dbData.primary_thumbnail_hash || null,
    JSON.stringify(productData.additionalImagesHashes || []),
    dbData.createdAt,
    dbData.updatedAt
  );
  
  stmt.finalize();
  
  return this.getProduct(id);
}
```

#### 2.4 Update updateProduct Method

Similar changes for the UPDATE statement to use mapped field names.

#### 2.5 Verification Steps

**Verification Checklist:**
- [ ] All database operations still work correctly
- [ ] Field mappings applied consistently
- [ ] JSON array parsing handles edge cases
- [ ] No TypeScript errors in ProjectFileManager

**Test Commands:**
```bash
cd electron-app
npm run type-check
npm run build:main
```

**Manual Testing:**
1. Start the app: `npm run dev`
2. Create a new product with images
3. Verify product saves correctly
4. Check database directly to ensure snake_case fields are populated
5. Load existing products to verify parsing works

---

### Step 3: Fix TypeScript Interface Consistency
**Priority:** High - Type safety across application  
**Risk:** Low - Type definition changes only  
**Time Estimate:** 30 minutes

#### 3.1 Update Shared Product Interface

**File:** `electron-app/src/shared/types/project.types.ts`

Ensure consistency:
```typescript
export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId?: string;  // Optional to match DB
  location: string[];  // Always array
  description?: string;  // Optional to match DB
  specificationDescription?: string;  // Optional to match DB
  category: string[];  // Always array, never string
  product_name: string;
  manufacturer?: string;
  price?: number;
  
  // Asset management fields - camelCase
  primaryImageHash?: string;
  primaryThumbnailHash?: string;
  additionalImagesHashes?: string[];  // Optional array
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### 3.2 Update Renderer Product Interface

**File:** `electron-app/src/renderer/types/index.ts`

Make it match exactly:
```typescript
export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId?: string;  // Make optional
  location: string[];  // Keep as array
  description?: string;  // Make optional
  specificationDescription?: string;  // Make optional
  category: string[];  // Change from string | string[] to just string[]
  product_name?: string;
  manufacturer?: string;
  price?: number;
  
  // Asset fields - ensure camelCase
  primaryImageHash?: string;
  primaryThumbnailHash?: string;
  additionalImagesHashes?: string[];
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### 3.3 Verification Steps

**Verification Checklist:**
- [ ] Both interfaces are identical
- [ ] Optional fields match database schema
- [ ] Array fields are consistently typed
- [ ] No TypeScript errors in components

**Test Commands:**
```bash
cd electron-app
npm run type-check
```

---

### Step 4: Update API Handlers with Field Mappings
**Priority:** High - API data flow  
**Risk:** Medium - Changes API behavior  
**Time Estimate:** 45 minutes

#### 4.1 Update API Handlers

**File:** `electron-app/src/main/api/apiHandlers.ts`

Add import:
```typescript
import { transformApiToInternal, transformInternalToApi } from '../../shared/mappings/apiFieldMappings';
```

#### 4.2 Update createProduct Method

**Around lines 295-350:**
```typescript
private async createProduct(data: any) {
  const manager = this.managers.get('current');
  if (!manager) {
    return { success: false, error: 'No active project' };
  }
  
  try {
    // Transform API fields to internal format
    const transformedData = transformApiToInternal(data);
    
    // Ensure required fields have defaults
    const productData = {
      projectId: 'current',
      url: transformedData.url || '',
      tagId: transformedData.tagId,
      location: transformedData.location || [],
      description: transformedData.description,
      specificationDescription: transformedData.specificationDescription,
      category: transformedData.category || [],
      product_name: transformedData.product_name || '',
      manufacturer: transformedData.manufacturer,
      price: transformedData.price,
      primaryImageHash: transformedData.primaryImageHash,
      primaryThumbnailHash: transformedData.primaryThumbnailHash,
      additionalImagesHashes: transformedData.additionalImagesHashes || []
    };
    
    const product = await manager.createProduct(productData);
    this.projectState.markDirty();
    
    // Transform back to API format for response
    return { 
      success: true, 
      data: transformInternalToApi(product)
    };
  } catch (error) {
    console.error('Failed to create product:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create product'
    };
  }
}
```

#### 4.3 Update updateProduct Method

**Around lines 271-297:**
```typescript
private async updateProduct(productId: string, data: any) {
  const manager = this.managers.get('current');
  if (!manager) {
    return { success: false, error: 'No active project' };
  }
  
  try {
    // Transform API fields to internal format
    const transformedData = transformApiToInternal(data);
    
    // Remove any null values from deprecated fields
    const cleanedData = Object.fromEntries(
      Object.entries(transformedData).filter(([_, v]) => v !== null)
    );
    
    const product = await manager.updateProduct(productId, cleanedData);
    this.projectState.markDirty();
    
    // Transform back to API format for response
    return { 
      success: true, 
      data: transformInternalToApi(product)
    };
  } catch (error) {
    console.error('Failed to update product:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update product'
    };
  }
}
```

#### 4.4 Remove Old Field Mapping Code

Remove the old hardcoded `fieldMapping` object that was incorrect.

#### 4.5 Verification Steps

**Verification Checklist:**
- [ ] API creates products with correct field names
- [ ] API updates products with correct field names
- [ ] Deprecated fields show console warnings
- [ ] API responses use correct external field names

**Test Commands:**
```bash
cd electron-app
npm run build:main
npm run dev
```

**Manual Testing:**
1. Create a product via the UI
2. Check console for any deprecation warnings
3. Update a product via the UI
4. Verify data saves correctly

---

### Step 5: Clean Up React Form Components
**Priority:** Medium - UI consistency  
**Risk:** Low - Frontend only  
**Time Estimate:** 45 minutes

#### 5.1 Update ProductNew Component

**File:** `electron-app/src/renderer/pages/ProductNew.tsx`

Update form state interface and initial state:
```typescript
interface ProductFormData {
  // API field names
  product_url: string;
  tag_id: string;
  product_location: string[];
  product_description: string;
  specification_description: string;
  category: string[];
  product_name?: string;
  manufacturer?: string;
  price?: number;
  
  // Asset management - correct field names
  primary_image_hash?: string;
  primary_thumbnail_hash?: string;
  additional_images_hashes: string[];
}

const [formData, setFormData] = useState<ProductFormData>({
  product_url: '',
  tag_id: '',
  product_location: [],
  product_description: '',
  specification_description: '',
  category: [],
  additional_images_hashes: []
});
```

#### 5.2 Update Form Submission

**Around lines 241-247:**
```typescript
const handleSaveProduct = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!formData.product_url) {
    showToast('Product URL is required', 'error');
    return;
  }
  
  try {
    setIsSubmitting(true);
    
    // Submit with correct field names - no manual mapping needed
    const response = await api.post('/api/products', {
      ...formData,
      project_id: 'current'
    });
    
    if (response.data.success) {
      showToast('Product saved successfully', 'success');
      navigate('/project');
    } else {
      throw new Error(response.data.error || 'Failed to save product');
    }
  } catch (error) {
    const apiError = handleApiError(error);
    showToast(apiError.message, 'error');
  } finally {
    setIsSubmitting(false);
  }
};
```

#### 5.3 Remove Legacy Image Field References

Remove any references to:
- `custom_image_url`
- `product_image`
- `product_images`
- `image_hash` (replace with `primary_image_hash`)
- `thumbnail_hash` (replace with `primary_thumbnail_hash`)
- `images_hashes` (replace with `additional_images_hashes`)

#### 5.4 Update ProductPage Component

**File:** `electron-app/src/renderer/pages/ProductPage.tsx`

Similar updates for edit form state and field references.

#### 5.5 Verification Steps

**Verification Checklist:**
- [ ] Form state uses correct API field names
- [ ] No references to legacy image fields
- [ ] Form submission doesn't require manual mapping
- [ ] Image uploads use correct hash field names

**Test Commands:**
```bash
cd electron-app
npm run type-check
npm run build:renderer
```

**Manual Testing:**
1. Create a new product with all fields
2. Upload images and verify they save
3. Edit an existing product
4. Verify all fields update correctly

---

### Step 6: Create Asset URL Utility Functions
**Priority:** Medium - Code organization  
**Risk:** Low - New utilities  
**Time Estimate:** 30 minutes

#### 6.1 Create Asset Utilities

**New File:** `electron-app/src/shared/utils/assetUtils.ts`

```typescript
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
```

#### 6.2 Update Components to Use Asset Utilities

**File:** `electron-app/src/renderer/pages/ProjectPage.tsx`

Add import:
```typescript
import { getProductImageUrl, getPlaceholderImage } from '../../shared/utils/assetUtils';
```

Update image rendering (around line 264):
```typescript
<img 
  src={getProductImageUrl(product) || getPlaceholderImage()} 
  alt={product.description || 'Product image'}
  className="w-full h-48 object-cover"
/>
```

#### 6.3 Update ProductPage Component

**File:** `electron-app/src/renderer/pages/ProductPage.tsx`

Similar updates for all image references to use the utility functions.

#### 6.4 Verification Steps

**Verification Checklist:**
- [ ] Asset URLs consistently use asset:// protocol
- [ ] Image fallback logic works correctly
- [ ] Placeholder images show for missing assets
- [ ] No hardcoded asset URL construction

**Test Commands:**
```bash
cd electron-app
npm run type-check
npm run dev
```

**Manual Testing:**
1. View products with images
2. View products without images (should show placeholder)
3. Verify thumbnail preference over primary image

---

### Step 7: Final Integration Testing
**Priority:** Critical - Ensure everything works together  
**Risk:** N/A - Testing only  
**Time Estimate:** 1 hour

#### 7.1 Full System Test

**Test Scenarios:**

1. **Create Product Flow:**
   - Create product with all fields
   - Upload primary image
   - Upload thumbnail
   - Upload additional images
   - Save and verify all data persists

2. **Update Product Flow:**
   - Edit existing product
   - Change images
   - Update all fields
   - Save and verify changes

3. **Data Integrity:**
   - Check database directly for correct field names
   - Verify snake_case in DB, camelCase in app
   - Ensure no data loss during transformations

4. **API Testing:**
   - Test API endpoints directly with curl/Postman
   - Verify field name transformations work both ways
   - Check deprecation warnings for legacy fields

5. **Performance:**
   - Load project with many products
   - Verify no performance degradation
   - Check memory usage remains stable

#### 7.2 Verification Checklist

**Final Verification:**
- [ ] All products display correctly
- [ ] Images load via asset protocol
- [ ] Form validation works
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Database integrity maintained
- [ ] API backwards compatibility (with warnings)

---

## Rollback Plan

If issues arise at any step:

1. **Version Control:** All changes should be committed separately
2. **Database Backup:** Back up the database before testing
3. **Gradual Rollout:** Can deploy changes incrementally
4. **Feature Flag:** Consider adding feature flag for new mapping system

## Success Criteria

- ✅ Zero runtime errors related to field mismatches
- ✅ All existing data remains accessible
- ✅ New products save with correct field mappings
- ✅ Asset management works consistently
- ✅ TypeScript type safety throughout
- ✅ Clean, maintainable code structure

## Notes

- Keep browser DevTools console open during testing
- Watch for deprecation warnings
- Document any unexpected behavior
- Consider adding unit tests for mapping functions