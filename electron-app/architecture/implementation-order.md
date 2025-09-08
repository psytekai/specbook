# Implementation Order: File-Based Desktop Application

## Overview
This implementation plan transforms the Electron app into a true desktop application with `.specbook` project files, while maintaining 100% frontend compatibility. Each phase is independently testable.

## Phase 0: Prerequisites & Setup (Day 1)
**Goal**: Prepare codebase without breaking anything

### Tasks:
1. **Create parallel structure** (don't modify existing code yet)
   ```
   src/main/
   ├── services/
   │   ├── ProjectFileManager.ts
   │   ├── AssetManager.ts
   │   └── DatabaseManager.ts
   ├── handlers/
   │   ├── fileHandlers.ts
   │   └── apiHandlers.ts
   └── types/
       └── project.types.ts
   ```

2. **Install required dependencies**
   ```json
   "better-sqlite3": "^9.0.0",
   "sharp": "^0.33.0",
   "electron-store": "^8.1.0"
   ```

3. **Create type definitions** matching current API
4. **Set up test project directory** for development

### Validation:
- [ ] App still runs normally
- [ ] No existing functionality broken
- [ ] New folders/files in place

---

## Phase 1: Project File Manager Core (Days 2-3)
**Goal**: Create and manage `.specbook` directories without touching existing API

### Tasks:
1. **Implement ProjectFileManager class**
   - `createProjectStructure()` - Create `.specbook` directory
   - `initializeDatabase()` - Set up SQLite with schema
   - `createManifest()` - Generate manifest.json
   - `validateProjectStructure()` - Verify project integrity

2. **Create standalone test script**
   ```typescript
   // test-project-creation.ts
   const manager = new ProjectFileManager();
   await manager.createProject('./test.specbook');
   ```

3. **Implement basic CRUD operations**
   - `getProducts()` matching current API response format
   - `createProduct()` with same data structure
   - `updateProduct()` maintaining compatibility
   - `deleteProduct()` with proper cleanup

### Validation:
- [ ] Can create valid `.specbook` directory structure
- [ ] SQLite database has correct schema
- [ ] Can perform CRUD operations via manager
- [ ] Data format matches current API exactly

---

## Phase 2: IPC Bridge Infrastructure (Days 4-5)
**Goal**: Create IPC handlers that mirror current API, but don't connect them yet

### Tasks:
1. **Extend preload script** (keep existing, add new)
   ```typescript
   // Add to existing preload.ts
   contextBridge.exposeInMainWorld('electronFileAPI', {
     // New file operations (not used yet)
     testConnection: () => ipcRenderer.invoke('file:test'),
     // ... other methods
   });
   ```

2. **Create IPC handlers in main process**
   ```typescript
   // src/main/handlers/fileHandlers.ts
   ipcMain.handle('file:test', async () => {
     return { success: true, message: 'IPC working' };
   });
   ```

3. **Create parallel API handlers** (not replacing existing yet)
   ```typescript
   // src/main/handlers/apiHandlers.ts
   ipcMain.handle('api-v2:get-products', async (event, params) => {
     return projectManager.getProducts(params);
   });
   ```

4. **Add development toggle** to test new system
   ```typescript
   const USE_FILE_SYSTEM = process.env.USE_FILE_SYSTEM === 'true';
   ```

### Validation:
- [ ] Can call test IPC from renderer console
- [ ] New handlers return correct data format
- [ ] Existing API still works unchanged
- [ ] Can toggle between systems via env variable

---

## Phase 3: File Menu & Operations (Days 6-7)
**Goal**: Add File menu without breaking current project loading

### Tasks:
1. **Implement File menu** in Electron main
   ```typescript
   // Initially, menu items just log actions
   { label: 'New Project', click: () => console.log('New project') }
   ```

2. **Create file operation handlers**
   - New Project → Create `.specbook` and return project data
   - Open Project → Load `.specbook` and return project data
   - Save Project → Update manifest (initially no-op)
   - Recent Projects → Track in electron-store

3. **Add project state to main process**
   ```typescript
   class ProjectStateManager {
     currentProject: ProjectInfo | null;
     recentProjects: string[];
   }
   ```

4. **Create "Open With" dialog** on startup (optional)
   - Show recent projects
   - Allow opening existing project
   - Create new project option

### Validation:
- [ ] File menu appears and responds
- [ ] Can create new `.specbook` via menu
- [ ] Can open existing `.specbook` via menu
- [ ] Recent projects list updates
- [ ] Current app still loads normally

---

## Phase 4: API Service Replacement (Days 8-9)
**Goal**: Create drop-in replacement for current API service

### Tasks:
1. **Create new API service** that routes to IPC
   ```typescript
   // src/renderer/services/api-v2.ts
   export const api = {
     async get(endpoint: string, params?: any) {
       if (endpoint.includes('/products')) {
         return window.electronFileAPI.getProducts(params);
       }
       // ... route other endpoints
     }
   };
   ```

2. **Add environment-based switching**
   ```typescript
   // src/renderer/services/index.ts
   export const api = USE_FILE_SYSTEM ? apiV2 : apiV1;
   ```

3. **Test each endpoint individually**
   - Products CRUD
   - Categories
   - Locations
   - Project operations

4. **Add progress indicators** for file operations

### Validation:
- [ ] Can switch between old/new API via flag
- [ ] All CRUD operations work with new API
- [ ] Data persistence works correctly
- [ ] No frontend components need changes

---

## Phase 5: Asset Management System (Days 10-11)
**Goal**: Implement content-addressable storage for images

### Tasks:
1. **Implement AssetManager class**
   - SHA-256 based storage
   - Automatic deduplication
   - Thumbnail generation with Sharp

2. **Update product image handling**
   - Store images as files, not BLOBs
   - Update database to store hash references
   - Implement `getAssetPath()` for retrieval

3. **Create image upload handler**
   ```typescript
   ipcMain.handle('asset:upload', async (event, fileData) => {
     const hash = await assetManager.storeAsset(fileData);
     return { hash, url: `asset://${hash}` };
   });
   ```

4. **Register custom protocol** for assets
   ```typescript
   protocol.registerFileProtocol('asset', (request, callback) => {
     const hash = request.url.replace('asset://', '');
     const path = assetManager.getAssetPath(hash);
     callback({ path });
   });
   ```

### Validation:
- [ ] Images upload and store correctly
- [ ] Deduplication works (same image = same hash)
- [ ] Thumbnails generate automatically
- [ ] Images display in UI via asset:// protocol

---

## Phase 6: Python Integration (Days 12-13)
**Goal**: Connect Python scraping without server

### Tasks:
1. **Create Python bridge service**
   ```typescript
   class PythonBridge {
     async runScript(script: string, args: any[])
     async scrapeProduct(url: string, params: any)
   }
   ```

2. **Modify Python scripts** for CLI usage
   - Accept JSON input via stdin
   - Return JSON output via stdout
   - Handle errors gracefully

3. **Implement progress reporting**
   - Use IPC for progress updates
   - Show in UI progress bar

4. **Add Python detection/installation check**

### Validation:
- [ ] Can call Python scripts from Electron
- [ ] Scraping returns correct data format
- [ ] Error handling works properly
- [ ] Progress updates display in UI

---

## Phase 7: Migration & Cleanup (Days 14-15)
**Goal**: Switch fully to new system and clean up

### Tasks:
1. **Remove old API service code**
2. **Update all imports to use new API**
3. **Remove environment toggle flags**
4. **Create data migration utility** (if needed)
5. **Update build configuration**
6. **Clean up unused dependencies**

### Validation:
- [ ] App works entirely with file system
- [ ] No references to old API remain
- [ ] Build size reduced
- [ ] All tests pass

---

## Phase 8: Polish & Optimization (Days 16-17)
**Goal**: Production-ready features

### Tasks:
1. **Add auto-save** functionality
2. **Implement file locking** for safety
3. **Add backup system** (.specbook.backup)
4. **Optimize database queries** with indexes
5. **Add file association** in OS
6. **Implement undo/redo** system
7. **Add export features** (PDF, CSV)

### Validation:
- [ ] Auto-save works reliably
- [ ] Can't corrupt projects with concurrent access
- [ ] Performance is acceptable for large projects
- [ ] File associations work on all platforms

---

## Testing Strategy

### Each Phase Should Have:
1. **Unit tests** for new services
2. **Integration tests** for IPC communication
3. **Manual testing checklist**
4. **Rollback plan** if issues found

### Critical Test Scenarios:
- [ ] Create new project → Add products → Close → Reopen
- [ ] Open existing project → Modify → Save As → Verify both
- [ ] Large project with 1000+ products
- [ ] Corrupt file handling
- [ ] Network failure during Python operations
- [ ] Concurrent access attempts

---

## Risk Mitigation

### Parallel Development:
- Keep old system functional throughout
- Use feature flags for gradual rollout
- Test with subset of users first

### Data Safety:
- Always backup before operations
- Implement atomic writes
- Use SQLite transactions properly
- WAL mode for better concurrency

### Rollback Points:
- After each phase, tag git commit
- Keep old API code until Phase 7
- Document rollback procedures

---

## Success Metrics

- [ ] **Zero frontend changes required**
- [ ] **All existing features work**
- [ ] **File operations < 100ms**
- [ ] **Project load < 500ms for 1000 products**
- [ ] **Python scraping unchanged**
- [ ] **Reduced deployment complexity**
- [ ] **Standard desktop UX patterns**