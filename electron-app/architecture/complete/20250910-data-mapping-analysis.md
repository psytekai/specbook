# Data Mapping Analysis Report

**Date:** 2025-09-10  
**Status:** Critical Issues Identified  
**Priority:** High - Data Integrity Risk  

## Executive Summary

Analysis of data mappings across database schema, IPC interfaces, and React state structures reveals multiple critical inconsistencies that pose data integrity risks and potential runtime errors. This document provides detailed findings with code examples and actionable remediation steps.

## Critical Issues Identified

### 1. Field Name Mismatches (Critical)

**Location:** Database Schema ↔ TypeScript Interfaces

#### Current State Problems

**Database Schema** (`ProjectFileManager.ts:71-90`):
```sql
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  url TEXT NOT NULL,
  tagId TEXT,
  location TEXT,  -- JSON string
  description TEXT,
  specificationDescription TEXT,
  category TEXT,  -- JSON string
  product_name TEXT,
  manufacturer TEXT,
  price REAL,
  primary_image_hash TEXT,      -- snake_case
  primary_thumbnail_hash TEXT,  -- snake_case
  additional_images_hashes TEXT, -- snake_case
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**TypeScript Interface** (`project.types.ts:6-29`):
```typescript
export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId?: string;
  location: string[];
  description?: string;
  specificationDescription?: string;
  category: string[];
  product_name: string;
  manufacturer?: string;
  price?: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Asset management fields (Phase 4)
  primaryImageHash?: string;        // camelCase
  primaryThumbnailHash?: string;    // camelCase
  additionalImagesHashes?: string[]; // camelCase
}
```

**Renderer Interface** (`renderer/types/index.ts:11-29`):
```typescript
export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId: string;  // NOT optional here!
  location: string[];
  description: string;  // NOT optional here!
  specificationDescription: string;  // NOT optional here!
  category: string | string[];  // DIFFERENT type flexibility
  product_name?: string;
  manufacturer?: string;
  price?: number;
  primaryImageHash?: string;
  primaryThumbnailHash?: string;
  additionalImagesHashes?: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

#### Desired State

**Unified Field Mapping**:
```typescript
// New file: electron-app/src/shared/mappings/fieldMappings.ts
export const DB_TO_INTERFACE_MAPPING = {
  // Asset fields
  'primary_image_hash': 'primaryImageHash',
  'primary_thumbnail_hash': 'primaryThumbnailHash', 
  'additional_images_hashes': 'additionalImagesHashes',
  
  // Standard fields (no change needed)
  'product_name': 'product_name',
  'tagId': 'tagId',
  'projectId': 'projectId'
} as const;

export const INTERFACE_TO_DB_MAPPING = Object.fromEntries(
  Object.entries(DB_TO_INTERFACE_MAPPING).map(([k, v]) => [v, k])
);
```

**Verification Checklist**:
- [ ] All database column names map to TypeScript interface fields
- [ ] No orphaned fields in either direction
- [ ] Field mapping is bijective (one-to-one)
- [ ] Asset hash fields consistently use camelCase in interfaces
- [ ] Database migration preserves existing data

### 2. Data Type Inconsistencies (Critical)

#### Problem: Category/Location Array Handling

**Current State - Database Storage** (`ProjectFileManager.ts:319-328`):
```typescript
stmt.run(
  // ... other fields
  JSON.stringify(productData.location || []),      // Stored as JSON string
  JSON.stringify(productData.category || []),      // Stored as JSON string
  // ... other fields
);
```

**Current State - Data Retrieval** (`ProjectFileManager.ts:703-723`):
```typescript
private parseProductRow(row: any): Product {
  return {
    // ... other fields
    location: row.location ? JSON.parse(row.location) : [],
    category: row.category ? JSON.parse(row.category) : [],
    // ... other fields
    additionalImagesHashes: row.additional_images_hashes ? JSON.parse(row.additional_images_hashes) : []
  };
}
```

**Problem - Inconsistent Interface Types**:
```typescript
// Main types (project.types.ts)
category: string[];  // Always array

// Renderer types (renderer/types/index.ts) 
category: string | string[];  // Mixed type - causes confusion
```

#### Desired State

**Consistent Array Handling**:
```typescript
// Update renderer/types/index.ts to match main types
export interface Product {
  // ... other fields
  category: string[];  // Always array, never string
  location: string[];  // Always array
  additionalImagesHashes: string[];  // Always array
}

// Add validation in parseProductRow
private parseProductRow(row: any): Product {
  return {
    // ... other fields
    location: this.ensureArray(row.location),
    category: this.ensureArray(row.category),  
    additionalImagesHashes: this.ensureArray(row.additional_images_hashes)
  };
}

private ensureArray(jsonField: string | null): string[] {
  if (!jsonField) return [];
  try {
    const parsed = JSON.parse(jsonField);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}
```

**Verification Checklist**:
- [ ] All array fields consistently typed as arrays across all interfaces
- [ ] JSON parsing includes error handling
- [ ] Empty/null values default to empty arrays
- [ ] No string/array type confusion in React components
- [ ] Database stores valid JSON for all array fields

### 3. IPC Field Mapping Issues (High Priority)

#### Problem: Inconsistent API Field Transformations

**Current State** (`apiHandlers.ts:295-350`):
```typescript
private async createProduct(data: any) {
  const product = await manager.createProduct({
    projectId: 'current',
    url: data.product_url,          // API field name
    tagId: data.tag_id,             // API field name  
    location: data.product_location, // API field name
    description: data.product_description, // API field name
    specificationDescription: data.specification_description, // API field name
    category: data.category,
    product_name: data.product_name,
    manufacturer: data.manufacturer,
    price: data.price,
    // Missing asset hash field mappings!
    primaryImageHash: data.primary_image_hash,
    primaryThumbnailHash: data.primary_thumbnail_hash,
    additionalImagesHashes: data.additional_images_hashes
  });
}
```

**Current State - Update Product** (`apiHandlers.ts:271-297`):
```typescript
const fieldMapping: Record<string, string> = {
  product_url: 'url',
  tag_id: 'tagId', 
  product_location: 'location',
  product_image: 'image',          // Unused field!
  product_images: 'images',        // Unused field!
  product_description: 'description',
  specification_description: 'specificationDescription',
  image_hash: 'imageHash',         // Wrong field name!
  thumbnail_hash: 'thumbnailHash', // Wrong field name!
  images_hashes: 'imagesHashes'    // Wrong field name!
};
```

#### Desired State

**Centralized Field Mapping**:
```typescript
// New file: electron-app/src/shared/mappings/apiFieldMappings.ts
export const API_TO_INTERNAL_FIELD_MAPPING = {
  // URL and identification
  'product_url': 'url',
  'tag_id': 'tagId',
  'project_id': 'projectId',
  
  // Content fields
  'product_location': 'location',
  'product_description': 'description', 
  'specification_description': 'specificationDescription',
  'product_name': 'product_name',
  
  // Asset management (corrected)
  'primary_image_hash': 'primaryImageHash',
  'primary_thumbnail_hash': 'primaryThumbnailHash', 
  'additional_images_hashes': 'additionalImagesHashes',
  
  // Legacy fields (deprecated)
  'custom_image_url': null,  // Remove
  'product_image': null,     // Remove
  'product_images': null,    // Remove
  'image_hash': 'primaryImageHash',      // Redirect to correct field
  'thumbnail_hash': 'primaryThumbnailHash', // Redirect to correct field
  'images_hashes': 'additionalImagesHashes' // Redirect to correct field
} as const;

export function transformApiFieldsToInternal(apiData: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [apiField, internalField] of Object.entries(API_TO_INTERNAL_FIELD_MAPPING)) {
    if (apiData[apiField] !== undefined) {
      if (internalField === null) {
        console.warn(`Deprecated API field ignored: ${apiField}`);
        continue;
      }
      result[internalField] = apiData[apiField];
    }
  }
  
  // Copy non-mapped fields directly
  for (const [key, value] of Object.entries(apiData)) {
    if (!(key in API_TO_INTERNAL_FIELD_MAPPING)) {
      result[key] = value;
    }
  }
  
  return result;
}
```

**Updated API Handlers**:
```typescript
private async createProduct(data: any) {
  const transformedData = transformApiFieldsToInternal(data);
  const product = await manager.createProduct({
    projectId: 'current',
    ...transformedData
  });
  this.projectState.markDirty();
  return { success: true, data: product };
}

private async updateProduct(productId: string, data: any) {
  const transformedData = transformApiFieldsToInternal(data);
  const product = await manager.updateProduct(productId, transformedData);
  this.projectState.markDirty();
  return { success: true, data: product };
}
```

**Verification Checklist**:
- [ ] All API field names consistently map to internal field names
- [ ] Legacy field names are handled with deprecation warnings
- [ ] Asset hash fields use correct camelCase names
- [ ] No undefined fields passed to database layer
- [ ] Transformation is bidirectional for API responses

### 4. React Form State Issues (Medium Priority)

#### Problem: Form Field Inconsistencies

**Current State** (`ProductNew.tsx:20-33`):
```typescript
const [formData, setFormData] = useState({
  product_url: '',
  tag_id: '',
  product_location: [] as string[],
  product_image: '',                    // Legacy field
  product_images: [] as string[],       // Legacy field  
  product_description: '',
  specification_description: '',
  category: [] as string[],
  custom_image_url: '',                 // Deprecated
  image_hash: '',                       // Wrong field name
  thumbnail_hash: '',                   // Wrong field name
  images_hashes: [] as string[],        // Wrong field name
});
```

**Current State - Form Submission** (`ProductNew.tsx:241-247`):
```typescript
await api.post('/api/products', {
  ...formData,
  primary_image_hash: formData.image_hash || undefined,           // Manual mapping
  primary_thumbnail_hash: formData.thumbnail_hash || undefined,   // Manual mapping
  additional_images_hashes: formData.images_hashes.length > 0 ? formData.images_hashes : undefined,
  project_id: 'current'
});
```

#### Desired State

**Consistent Form State**:
```typescript
// ProductNew.tsx - Updated form state
interface ProductFormState {
  // API field names for submission
  product_url: string;
  tag_id: string;
  product_location: string[];
  product_description: string;
  specification_description: string;
  category: string[];
  product_name?: string;
  manufacturer?: string;
  price?: number;
  
  // Asset management (correct field names)
  primary_image_hash?: string;
  primary_thumbnail_hash?: string;
  additional_images_hashes: string[];
  
  // UI-only fields (not submitted)
  isUploading?: boolean;
  uploadProgress?: number;
}

const [formData, setFormData] = useState<ProductFormState>({
  product_url: '',
  tag_id: '',
  product_location: [],
  product_description: '',
  specification_description: '',
  category: [],
  additional_images_hashes: []
});

// Clean submission without manual field mapping
const handleSaveProduct = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    await api.post('/api/products', {
      ...formData,
      project_id: 'current'
    });
    
    showToast('Product saved successfully', 'success');
    navigate('/project');
  } catch (error) {
    const apiError = handleApiError(error);
    showToast(apiError.message, 'error');
  }
};
```

**Verification Checklist**:
- [ ] Form state matches API field names exactly
- [ ] No manual field mapping in form submission
- [ ] Asset hash fields use correct names
- [ ] Legacy fields removed from form state
- [ ] Type safety maintained with TypeScript interfaces

### 5. Database Schema Inconsistencies (Low Priority)

#### Problem: Optional vs Required Fields

**Current Database Schema**:
```sql
CREATE TABLE IF NOT EXISTS products (
  tagId TEXT,                    -- Optional in DB
  description TEXT,              -- Optional in DB
  specificationDescription TEXT, -- Optional in DB
  -- Asset fields optional (correct)
  primary_image_hash TEXT,
  primary_thumbnail_hash TEXT,
  additional_images_hashes TEXT
)
```

**Current Renderer Interface**:
```typescript
// renderer/types/index.ts - Some fields required
export interface Product {
  tagId: string;                      // Required (inconsistent)
  description: string;                // Required (inconsistent)  
  specificationDescription: string;   // Required (inconsistent)
}
```

#### Desired State

**Consistent Optionality**:
```typescript
// Update renderer/types/index.ts to match database reality
export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId?: string;                     // Optional (matches DB)
  location: string[];
  description?: string;               // Optional (matches DB)
  specificationDescription?: string;  // Optional (matches DB)
  category: string[];
  product_name?: string;
  manufacturer?: string;
  price?: number;
  primaryImageHash?: string;
  primaryThumbnailHash?: string;
  additionalImagesHashes?: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

**Verification Checklist**:
- [ ] Optional fields consistent between database and TypeScript
- [ ] React components handle undefined values gracefully
- [ ] Form validation matches database constraints
- [ ] No runtime errors from missing optional fields

## Asset Management Specific Issues

### Problem: Protocol Handler Inconsistencies

**Current State** (`ProductPage.tsx:356-360`):
```typescript
// Mix of asset protocol and fallback logic
<img 
  src={
    formData.thumbnail_hash 
      ? `asset://${formData.thumbnail_hash}`        // Uses thumbnail_hash
      : formData.custom_image_url                   // Legacy fallback
      || formData.product_image                     // Legacy fallback
  } 
  alt="Product image" 
  className="product-image"
/>
```

**Current State** (`ProductPage.tsx:264`):
```typescript
// Different field name usage
<img 
  src={product.primaryThumbnailHash ? `asset://${product.primaryThumbnailHash}` : `asset://${product.primaryImageHash}`} 
  alt={product.description}
/>
```

#### Desired State

**Consistent Asset URL Generation**:
```typescript
// New utility file: src/shared/utils/assetUtils.ts
export function getAssetUrl(hash: string | undefined): string | undefined {
  if (!hash) return undefined;
  return `asset://${hash}`;
}

export function getProductImageUrl(product: Product): string | undefined {
  // Priority: thumbnail -> primary image -> fallback
  return getAssetUrl(product.primaryThumbnailHash) 
    || getAssetUrl(product.primaryImageHash)
    || undefined;
}

// Usage in components:
<img 
  src={getProductImageUrl(product) || '/placeholder-image.png'} 
  alt={product.description || 'Product image'} 
  className="product-image"
/>
```

**Verification Checklist**:
- [ ] Asset URLs consistently use `asset://` protocol
- [ ] Image fallback logic is standardized
- [ ] No references to legacy image fields
- [ ] Placeholder images for missing assets

## Implementation Plan

### Phase 1: Type System Unification (Week 1)
1. Create shared field mapping utilities
2. Update all TypeScript interfaces for consistency
3. Add validation utilities for data transformation

### Phase 2: IPC Layer Cleanup (Week 2) 
1. Implement centralized field transformation
2. Update API handlers to use new mappings
3. Add deprecation warnings for legacy fields

### Phase 3: React Component Updates (Week 2)
1. Update form states to use correct field names
2. Remove legacy image handling code
3. Implement consistent asset URL utilities

### Phase 4: Database Schema Migration (Week 3)
1. Create migration script for any needed schema changes
2. Add database constraints for data integrity
3. Update reference counting for assets

### Phase 5: Testing & Validation (Week 3)
1. Create integration tests for data flow
2. Add validation for all transformation functions
3. Performance testing for large datasets

## Risk Assessment

**High Risk:**
- Data corruption during field name migrations
- Runtime errors from type mismatches
- Asset reference counting inconsistencies

**Medium Risk:**
- User interface confusion from field changes
- API backwards compatibility issues

**Low Risk:**
- Performance impact from data transformations
- Development workflow disruption

## Success Metrics

- [ ] Zero runtime errors related to field name mismatches
- [ ] 100% consistency between database and TypeScript types
- [ ] All asset references properly tracked and cleaned up
- [ ] No data loss during migration
- [ ] Full test coverage for data transformation functions