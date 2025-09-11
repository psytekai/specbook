# Claude Code Prompt: Phase 4.8 Frontend Asset Upload Integration

**UPDATE 2025-09-10**: Backend architecture fully restored. Focus now on frontend integration.

## Context & Background

This Electron app is implementing **Phase 4.8** of the file-based desktop application transformation. The backend AssetManager infrastructure is **now complete and fully functional** (Phase 4.1-4.7), but the frontend still uses legacy data URL uploads that bypass the asset management system entirely.

## 🎯 Current Status Summary

### ✅ **BACKEND FULLY RESOLVED** 
- **Content-addressable storage**: Thumbnails properly hashed by content
- **Database integrity**: `thumbnail_hash` field included in schema
- **Proper cleanup**: Asset deletion uses stored hashes, not conventions
- **Storage efficiency**: Deduplication works for identical thumbnails

### ❌ **FRONTEND INTEGRATION MISSING**
- **ProductNew.tsx still bypasses AssetManager**: Uses FileReader + data URLs
- **No asset protocol support**: Images don't use `asset://` for display
- **Missing hash fields**: Form doesn't include `image_hash`/`thumbnail_hash`
- **No validation**: File size, type, dimension checks missing

## Current State Assessment

### ✅ **Completed (Backend Infrastructure)**
- AssetManager class with content-addressable storage ✅
- Custom `asset://` protocol registration ✅
- IPC handlers for asset upload/retrieval ✅
- Database schema supports asset hash fields ✅
- SHA-256 hashing with deduplication ✅
- Automatic thumbnail generation with Sharp ✅
- **NEW**: True content-addressable thumbnail storage ✅
- **NEW**: Proper thumbnail deletion using stored hashes ✅
- **NEW**: Database `thumbnail_hash` field implementation ✅

### ❌ **Remaining Frontend Issues**
The frontend implementation needs to be updated to use the fully-functional backend:

1. **ProductNew.tsx** uses `FileReader.readAsDataURL()` instead of AssetManager
2. **No AssetManager integration** - loses all content-addressable benefits
3. **Data URL storage** - inefficient base64 encoding in memory
4. **No deduplication** - identical images stored multiple times
5. **No thumbnail generation** - lost automatic optimization
6. **Missing asset hash fields** - form submission doesn't include `image_hash`/`thumbnail_hash`

**Good News**: All backend infrastructure is ready and waiting for frontend integration.

## 🎯 **PRIORITY: Frontend Integration Tasks**

With backend fully functional, **these are the only remaining blockers**:

### **1. HIGH PRIORITY: Replace FileReader in ProductNew.tsx**
- **Current**: Lines 121-136 use `FileReader.readAsDataURL()`
- **Needed**: Replace with `window.electronAPI.assetUpload()` 
- **Impact**: Unlocks content-addressable storage benefits

### **2. HIGH PRIORITY: Add Asset Hash Fields to Form**
- **Current**: Form only has `custom_image_url` string field
- **Needed**: Add `image_hash`, `thumbnail_hash`, `images_hashes` fields
- **Impact**: Enables proper asset tracking and deduplication

### **3. MEDIUM PRIORITY: Update Image Display Logic** 
- **Current**: Only shows `formData.custom_image_url || formData.product_image`
- **Needed**: Support `asset://${thumbnailHash}` protocol
- **Impact**: Displays optimized thumbnails instead of full images

### **4. LOW PRIORITY: Upload Progress & Error Handling**
- **Current**: Basic file input with minimal feedback
- **Needed**: Progress indication and proper error messages
- **Impact**: Better user experience during uploads

## Regression Analysis

### Current Broken Implementation (ProductNew.tsx:124-139)
```typescript
// Convert file to data URL - WRONG APPROACH
const reader = new FileReader();
reader.onload = (e) => {
  const imageUrl = e.target?.result as string;
  setFormData(prev => ({
    ...prev,
    custom_image_url: imageUrl  // Base64 data URL instead of hash
  }));
};
reader.readAsDataURL(file);
```

### Problems with Current Approach
- **Storage inefficiency**: Base64 encoding increases size by ~33%
- **Memory waste**: Large images stored in component state
- **No deduplication**: Same image uploaded multiple times = multiple copies
- **No optimization**: No automatic thumbnail generation
- **Broken architecture**: Bypasses entire AssetManager system

## Phase 4.8 Implementation Requirements

### 1. **Restore AssetManager Integration in ProductNew.tsx**

**Goal**: Replace FileReader with proper AssetManager upload

**Current Broken Code**:
```typescript
// Lines 124-139 - REMOVE THIS
const reader = new FileReader();
reader.onload = (e) => {
  const imageUrl = e.target?.result as string;
  setFormData(prev => ({
    ...prev,
    custom_image_url: imageUrl
  }));
};
reader.readAsDataURL(file);
```

**Required Fix**:
```typescript
const handleImageUpload = async (file: File) => {
  try {
    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('Image file size must be less than 5MB', 'error');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error');
      return;
    }

    // Convert File to ArrayBuffer for AssetManager
    const arrayBuffer = await file.arrayBuffer();
    
    // Upload via AssetManager IPC
    const response = await window.electronAPI.assetUpload(
      arrayBuffer, 
      file.name, 
      file.type
    );
    
    if (response.success) {
      // Store asset hashes instead of data URL
      setFormData(prev => ({
        ...prev,
        image_hash: response.data.hash,
        thumbnail_hash: response.data.thumbnailHash,
        // Clear old data URL field
        custom_image_url: ''
      }));
      showToast('Image uploaded successfully', 'success');
    } else {
      throw new Error(response.error || 'Upload failed');
    }
  } catch (error) {
    showToast('Failed to upload image', 'error');
    console.error('Image upload error:', error);
  }
};
```

### 2. **Update Form Data Structure**

**Add Missing Fields to useState**:
```typescript
const [formData, setFormData] = useState({
  // ... existing fields ...
  image_hash: '',           // ADD: Original asset hash
  thumbnail_hash: '',       // ADD: Thumbnail asset hash  
  images_hashes: [] as string[], // ADD: Additional images array
});
```

### 3. **Fix Image Display Logic**

**Current Broken Display (ProductNew.tsx:325-329)**:
```typescript
// Only shows data URL - BROKEN
<img 
  src={formData.custom_image_url || formData.product_image} 
  alt="Product image" 
/>
```

**Required Fix**:
```typescript
<img 
  src={
    formData.thumbnail_hash 
      ? `asset://${formData.thumbnail_hash}`        // Use optimized thumbnail
      : formData.custom_image_url                   // Fallback to data URL
      || formData.product_image                     // Fallback to scraped image
  } 
  alt="Product image" 
  className="product-image"
/>
```

### 4. **Update Form Submission**

**Current Missing Integration (ProductNew.tsx:211-214)**:
```typescript
// Form submission missing asset hashes
await api.post('/api/products', {
  ...formData,
  project_id: 'current'
});
```

**Required Fix**:
```typescript
await api.post('/api/products', {
  ...formData,
  image_hash: formData.image_hash || undefined,
  thumbnail_hash: formData.thumbnail_hash || undefined,
  images_hashes: formData.images_hashes.length > 0 ? formData.images_hashes : undefined,
  project_id: 'current'
});
```

### 5. **Add Upload Progress & Error Handling**

```typescript
const [uploadProgress, setUploadProgress] = useState(0);
const [isUploading, setIsUploading] = useState(false);

const handleImageUpload = async (file: File) => {
  setIsUploading(true);
  setUploadProgress(0);
  
  try {
    setUploadProgress(25);
    // Validation...
    
    setUploadProgress(50);
    const arrayBuffer = await file.arrayBuffer();
    
    setUploadProgress(75);
    const response = await window.electronAPI.assetUpload(/*...*/);
    
    setUploadProgress(100);
    // Success handling...
    
  } catch (error) {
    // Error handling...
  } finally {
    setTimeout(() => {
      setIsUploading(false);
      setUploadProgress(0);
    }, 500);
  }
};
```

### 6. **Add Remove Image Functionality**

**Update Remove Button Logic**:
```typescript
const handleRemoveImage = () => {
  setFormData(prev => ({ 
    ...prev, 
    custom_image_url: '',
    image_hash: '',           // Clear asset hash
    thumbnail_hash: ''        // Clear thumbnail hash
  }));
};
```

## ✅ AssetManager Architecture Issues - RESOLVED

**UPDATE 2025-09-10**: All critical backend issues have been resolved:

### ✅ **RESOLVED: Proper Content-Addressable Thumbnails**
```typescript
// AssetManager.ts:124 - NOW CORRECTLY IMPLEMENTED
const thumbnailBuffer = await this.generateThumbnail(fileData, size, quality);
thumbnailHash = this.generateHash(thumbnailBuffer); // Content-based hash
await this.saveAssetFile(thumbnailHash, thumbnailBuffer, true);
```

### ✅ **RESOLVED: Database Schema with thumbnail_hash**
```sql
-- ProjectFileManager.ts:158 - NOW INCLUDES FIELD
CREATE TABLE IF NOT EXISTS assets (
  hash TEXT PRIMARY KEY,
  thumbnail_hash TEXT,  -- ✅ Field properly included
  -- ... other fields
);
```

### ✅ **RESOLVED: Proper Thumbnail Deletion**
```typescript
// AssetManager.ts:231 - NOW USES STORED HASH
if (fullAssetInfo?.thumbnailHash) {
  const thumbnailPath = path.join(this.thumbnailsPath, fullAssetInfo.thumbnailHash);
  await fs.unlink(thumbnailPath); // Uses actual stored hash
}
```

**Architecture Decision Made**: **Option B** implemented - True content-addressable storage with proper database tracking.

## Required electronAPI Methods

Ensure these IPC methods are available in preload.ts:

```typescript
declare global {
  interface Window {
    electronAPI: {
      assetUpload: (
        data: ArrayBuffer, 
        filename: string, 
        mimetype: string
      ) => Promise<{
        success: boolean;
        data?: {
          hash: string;
          thumbnailHash: string;
          size: number;
          dimensions?: { width: number; height: number };
        };
        error?: string;
      }>;
      
      assetGetPath: (hash: string, thumbnail?: boolean) => Promise<string>;
      // ... other existing methods
    };
  }
}
```

## Testing Checklist

After implementation, verify:

- [ ] **Upload Flow**: File → ArrayBuffer → AssetManager → Hash storage
- [ ] **Display Flow**: Hash → `asset://` protocol → Image display  
- [ ] **Form Submission**: Asset hashes included in product data
- [ ] **Deduplication**: Same image uploaded twice = same hash
- [ ] **Thumbnail Display**: Optimized thumbnails load correctly
- [ ] **Error Handling**: Invalid files, large files, upload failures
- [ ] **Progress Indication**: Upload progress shows during processing
- [ ] **Remove Functionality**: Clearing image removes hashes
- [ ] **Legacy Fallback**: Old data URLs still display during transition

## Success Metrics

✅ **Phase 4.8 Complete When**:
- ProductNew.tsx uploads via AssetManager (not FileReader) ❌ **TODO**
- Form data includes `image_hash`/`thumbnail_hash` fields ❌ **TODO**
- Images display via `asset://` protocol ❌ **TODO**
- Upload progress and error handling work ❌ **TODO**
- Deduplication reduces storage waste ✅ **BACKEND READY**
- No regression in existing functionality ❌ **TODO**

**Current Progress**: Backend 100% complete, Frontend 0% complete

## Files to Modify

1. **`src/renderer/pages/ProductNew.tsx`** - Primary integration point ❌ **REMAINING**
2. ~~`src/main/services/AssetManager.ts`~~ ✅ **BACKEND COMPLETED**
3. **`src/main/preload.ts`** - Ensure assetUpload IPC exposed ❌ **VERIFY**
4. **`src/main/handlers/assetHandlers.ts`** - Verify IPC implementation ❌ **VERIFY**

**Focus Area**: Frontend integration in ProductNew.tsx is now the primary blocker.

## Updated Implementation Order

**Backend fixes completed ✅** - Focus now on frontend integration:

1. ~~Fix AssetManager thumbnail deletion bug~~ ✅ **COMPLETED**
2. **Restore AssetManager integration** in ProductNew.tsx ❌ **REMAINING**
3. **Update form data structure** with hash fields ❌ **REMAINING** 
4. **Fix image display logic** to use asset:// protocol ❌ **REMAINING**
5. **Add progress indication** and error handling ❌ **REMAINING**
6. **Test end-to-end workflow** thoroughly ❌ **REMAINING**

This implementation restores the intended content-addressable storage architecture and prepares for Phase 4.9 (asset display optimization).