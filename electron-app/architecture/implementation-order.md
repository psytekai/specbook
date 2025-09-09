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

## Phase 1: Project File Manager Core (Days 2-3) ✅ COMPLETE
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
- [✅] Can create valid `.specbook` directory structure
- [✅] SQLite database has correct schema
- [✅] Can perform CRUD operations via manager
- [✅] Data format matches current API exactly

---

## Phase 2: Complete Project Management & UX (Days 4-6) ✅ COMPLETE
**Goal**: Full project management system with native desktop UX

### Tasks:
1. **Create centralized project state management**
   ```typescript
   // src/main/services/ProjectState.ts
   import { ProjectFileManager } from './ProjectFileManager';
   import type { Project } from '../types/project.types';
   
   export class ProjectState {
     private manager: ProjectFileManager | null = null;
     private project: Project | null = null;
     private filePath: string | null = null;
     private isDirty: boolean = false;
   
     async openProject(filePath: string): Promise<Project> {
       this.manager = new ProjectFileManager();
       this.project = await this.manager.openProject(filePath);
       this.filePath = filePath;
       this.isDirty = false;
       return this.project;
     }
   
     async createProject(filePath: string, name: string): Promise<Project> {
       this.manager = new ProjectFileManager();
       this.project = await this.manager.createProject(filePath, name);
       this.filePath = filePath;
       this.isDirty = false;
       return this.project;
     }
   
     async saveProject(updates?: Partial<Project>): Promise<boolean> {
       if (!this.manager) throw new Error('No project open');
       const result = await this.manager.saveProject(updates || {});
       if (result) this.isDirty = false;
       return result;
     }
   
     async closeProject(): Promise<void> {
       if (this.manager) {
         await this.manager.closeProject();
       }
       this.manager = null;
       this.project = null;
       this.filePath = null;
       this.isDirty = false;
     }
   
     markDirty(): void {
       this.isDirty = true;
     }
   
     // Getters
     get isOpen(): boolean { return this.manager !== null; }
     get currentProject(): Project | null { return this.project; }
     get currentFilePath(): string | null { return this.filePath; }
     get hasUnsavedChanges(): boolean { return this.isDirty; }
     get manager(): ProjectFileManager | null { return this.manager; }
   }
   
   // src/main/index.ts
   import { ProjectState } from './services/ProjectState';
   
   const projectState = new ProjectState();
   ```

2. **Implement File menu with recent projects**
   ```typescript
   // First, install electron-store: npm install electron-store
   
   // src/main/menu.ts
   import { Menu, MenuItem, app } from 'electron';
   import Store from 'electron-store';
   import * as path from 'path';
   
   const store = new Store();
   
   export function createApplicationMenu() {
     const template = [
       {
         label: 'File',
         submenu: [
           {
             label: 'New Project...',
             accelerator: 'CmdOrCtrl+N',
             click: () => handleNewProject()
           },
           {
             label: 'Open Project...',
             accelerator: 'CmdOrCtrl+O', 
             click: () => handleOpenProject()
           },
           { type: 'separator' },
           {
             label: 'Save Project',
             accelerator: 'CmdOrCtrl+S',
             click: () => handleSaveProject(),
             enabled: false // Initially disabled
           },
           { type: 'separator' },
           {
             label: 'Recent Projects',
             submenu: [] // Populated dynamically
           }
         ]
       }
     ];
     
     const menu = Menu.buildFromTemplate(template);
     Menu.setApplicationMenu(menu);
     updateRecentProjectsMenu();
     return menu;
   }
   
   export function addToRecentProjects(filePath: string) {
     const recent = store.get('recentProjects', []) as string[];
     const updated = [filePath, ...recent.filter(p => p !== filePath)].slice(0, 10);
     store.set('recentProjects', updated);
     updateRecentProjectsMenu();
   }
   
   function updateRecentProjectsMenu() {
     const menu = Menu.getApplicationMenu();
     if (!menu) return;
     
     const fileMenu = menu.items.find(item => item.label === 'File');
     if (!fileMenu || !fileMenu.submenu) return;
     
     const recentMenuItem = fileMenu.submenu.items.find(item => item.label === 'Recent Projects');
     if (!recentMenuItem || !recentMenuItem.submenu) return;
     
     // Clear existing items
     recentMenuItem.submenu.clear();
     
     const recentProjects = store.get('recentProjects', []) as string[];
     
     if (recentProjects.length === 0) {
       recentMenuItem.submenu.append(new MenuItem({
         label: 'No Recent Projects',
         enabled: false
       }));
       return;
     }
     
     // Add recent project items
     recentProjects.forEach((projectPath) => {
       const projectName = path.basename(projectPath, '.specbook');
       recentMenuItem.submenu!.append(new MenuItem({
         label: projectName,
         sublabel: projectPath,
         click: () => openRecentProject(projectPath)
       }));
     });
     
     // Add separator and clear option
     recentMenuItem.submenu.append(new MenuItem({ type: 'separator' }));
     recentMenuItem.submenu.append(new MenuItem({
       label: 'Clear Recent Projects',
       click: () => {
         store.delete('recentProjects');
         updateRecentProjectsMenu();
       }
     }));
   }
   
   async function openRecentProject(filePath: string) {
     try {
       // Check if file still exists
       await fs.access(filePath);
       await projectState.openProject(filePath);
       updateWindowTitle(mainWindow);
       notifyRendererProjectChanged();
     } catch (error) {
       // Remove from recent if file doesn't exist
       const recent = store.get('recentProjects', []) as string[];
       const updated = recent.filter(p => p !== filePath);
       store.set('recentProjects', updated);
       updateRecentProjectsMenu();
       
       dialog.showErrorBox(
         'Project Not Found',
         `The project "${filePath}" could not be found. It may have been moved or deleted.`
       );
     }
   }
   
   export function updateMenuState() {
     const menu = Menu.getApplicationMenu();
     if (!menu) return;
     
     const fileMenu = menu.items.find(item => item.label === 'File');
     if (!fileMenu || !fileMenu.submenu) return;
     
     const saveMenuItem = fileMenu.submenu.items.find(item => item.label === 'Save Project');
     if (saveMenuItem) {
       saveMenuItem.enabled = projectState.isOpen;
     }
   }
   ```

3. **Create file operation handlers**
   ```typescript
   // src/main/handlers/projectHandlers.ts
   import { dialog, BrowserWindow } from 'electron';
   import { projectState } from '../index';
   
   export async function handleNewProject(mainWindow: BrowserWindow) {
     // Check for unsaved changes
     if (projectState.hasUnsavedChanges) {
       const response = await dialog.showMessageBox(mainWindow, {
         type: 'question',
         buttons: ['Save', "Don't Save", 'Cancel'],
         defaultId: 0,
         message: 'Do you want to save changes before creating a new project?'
       });
       
       if (response.response === 0) {
         await projectState.saveProject();
       } else if (response.response === 2) {
         return; // Cancel
       }
     }
   
     const result = await dialog.showSaveDialog(mainWindow, {
       title: 'Create New Project',
       defaultPath: 'MyProject.specbook',
       filters: [{ name: 'Specbook Projects', extensions: ['specbook'] }]
     });
     
     if (!result.canceled) {
       await projectState.createProject(result.filePath!, 'New Project');
       addToRecentProjects(result.filePath!);
       updateWindowTitle(mainWindow);
       updateMenuState();
       notifyRendererProjectChanged();
     }
   }
   
   export async function handleOpenProject(mainWindow: BrowserWindow) {
     // Check for unsaved changes
     if (projectState.hasUnsavedChanges) {
       const response = await dialog.showMessageBox(mainWindow, {
         type: 'question', 
         buttons: ['Save', "Don't Save", 'Cancel'],
         defaultId: 0,
         message: 'Do you want to save changes before opening another project?'
       });
       
       if (response.response === 0) {
         await projectState.saveProject();
       } else if (response.response === 2) {
         return; // Cancel
       }
     }
   
     const result = await dialog.showOpenDialog(mainWindow, {
       title: 'Open Project',
       filters: [{ name: 'Specbook Projects', extensions: ['specbook'] }],
       properties: ['openDirectory']
     });
     
     if (!result.canceled) {
       await projectState.openProject(result.filePaths[0]);
       addToRecentProjects(result.filePaths[0]);
       updateWindowTitle(mainWindow);
       updateMenuState();
       notifyRendererProjectChanged();
     }
   }
   
   export async function handleSaveProject() {
     if (projectState.isOpen) {
       await projectState.saveProject();
     }
   }
   
   function updateWindowTitle(mainWindow: BrowserWindow) {
     const project = projectState.currentProject;
     const title = project 
       ? `${project.name}${projectState.hasUnsavedChanges ? ' •' : ''} - Specbook Manager`
       : 'Specbook Manager';
     mainWindow.setTitle(title);
   }
   
   function notifyRendererProjectChanged() {
     // Send project change notification to renderer
     mainWindow?.webContents.send('project:changed', projectState.currentProject);
   }
   ```

4. **Add IPC for project status**
   ```typescript
   // src/main/handlers/ipcHandlers.ts
   import { ipcMain } from 'electron';
   import { projectState } from '../index';
   
   export function setupProjectIPC() {
     ipcMain.handle('project:get-current', async () => {
       return {
         project: projectState.currentProject,
         filePath: projectState.currentFilePath,
         isOpen: projectState.isOpen,
         hasUnsavedChanges: projectState.hasUnsavedChanges
       };
     });
   
     ipcMain.handle('project:close', async () => {
       await projectState.closeProject();
       updateWindowTitle(mainWindow);
       notifyRendererProjectChanged();
     });
   
     ipcMain.handle('project:save', async (event, updates) => {
       return await projectState.saveProject(updates);
     });
   
     ipcMain.handle('project:mark-dirty', async () => {
       projectState.markDirty();
       updateWindowTitle(mainWindow);
     });
   }
   ```

5. **Add "no project open" renderer UI state**
   ```typescript
   // src/renderer/components/NoProjectState.tsx - Empty state component
   import React from 'react';
   
   export function NoProjectState() {
     return (
       <div className="flex flex-col items-center justify-center h-64 text-gray-500">
         <div className="text-6xl mb-4">📁</div>
         <h2 className="text-xl font-semibold mb-2">No Project Open</h2>
         <p className="text-center mb-6 max-w-md">
           Create a new project or open an existing one to start managing your architectural specifications.
         </p>
         <div className="flex space-x-4">
           <button 
             className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
             onClick={() => {/* Trigger File > New via IPC */}}
           >
             Create New Project
           </button>
           <button 
             className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
             onClick={() => {/* Trigger File > Open via IPC */}}
           >
             Open Project
           </button>
         </div>
       </div>
     );
   }
   ```
   
6. **Add project status to renderer**
   ```typescript
   // src/renderer/hooks/useProject.ts - Complete project status management
   import { useState, useEffect } from 'react';
   
   export function useProject() {
     const [project, setProject] = useState(null);
     const [isOpen, setIsOpen] = useState(false);
     const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
   
     useEffect(() => {
       // Get initial project state
       window.electronAPI.getCurrentProject().then(projectInfo => {
         setProject(projectInfo.project);
         setIsOpen(projectInfo.isOpen);
         setHasUnsavedChanges(projectInfo.hasUnsavedChanges);
       });
   
       // Listen for project changes
       const handleProjectChanged = (projectInfo: any) => {
         setProject(projectInfo.project);
         setIsOpen(projectInfo.isOpen);
         setHasUnsavedChanges(projectInfo.hasUnsavedChanges);
       };
   
       window.electronAPI.onProjectChanged(handleProjectChanged);
   
       return () => {
         window.electronAPI.removeProjectChangedListener();
       };
     }, []);
   
     return { project, isOpen, hasUnsavedChanges };
   }
   ```

### Prerequisites:
```bash
# Install electron-store for persistent settings
npm install electron-store
```

### Validation:
- [✅] File menu appears and responds with keyboard shortcuts
- [✅] Can create new `.specbook` via menu and file dialogs
- [✅] Can open existing `.specbook` via menu and file dialogs  
- [✅] Recent projects menu populates and works
- [✅] Recent projects persist across app restarts
- [✅] "Save Project" menu item enabled/disabled correctly
- [ ] Window title shows current project name and dirty indicator (`•`)
- [ ] "No Project Open" UI state displays when appropriate
- [ ] Project status hook provides real-time updates to components
- [ ] Invalid recent projects are automatically removed
- [ ] "Clear Recent Projects" option works
- [ ] Unsaved changes prompts work correctly
- [ ] Project state is properly managed and synchronized

---

## Phase 3: API Integration & Error Handling (Days 7-8)
**Goal**: Seamlessly replace existing API with file-based operations and polished error handling

### Tasks:
1. **Audit existing API service**
   ```typescript
   // Identify current patterns in src/renderer/services/api.ts
   // Map all endpoints and their expected formats
   ```

2. **Create IPC handlers that replace current API**
   ```typescript
   // src/main/handlers/apiHandlers.ts
   import { ipcMain } from 'electron';
   import { projectState } from '../index';
   
   function requireOpenProject(mainWindow: BrowserWindow) {
     if (!projectState.isOpen) {
       // Proactively show "Open Project" dialog in renderer
       mainWindow.webContents.send('project:required');
       throw new Error('Please open or create a project first');
     }
   }
   
   export function setupAPIHandlers(mainWindow: BrowserWindow) {
     // Products
     ipcMain.handle('api:get-products', async (event, filters) => {
       requireOpenProject(mainWindow);
       return projectState.manager!.getProducts(filters);
     });
   
     ipcMain.handle('api:create-product', async (event, productData) => {
       requireOpenProject(mainWindow);
       const result = await projectState.manager!.createProduct(productData);
       projectState.markDirty();
       updateWindowTitle(mainWindow);
       return result;
     });
   
     ipcMain.handle('api:update-product', async (event, id, updates) => {
       requireOpenProject(mainWindow);
       const result = await projectState.manager!.updateProduct(id, updates);
       projectState.markDirty();
       updateWindowTitle(mainWindow);
       return result;
     });
   
     ipcMain.handle('api:delete-product', async (event, id) => {
       requireOpenProject(mainWindow);
       const result = await projectState.manager!.deleteProduct(id);
       if (result) {
         projectState.markDirty();
         updateWindowTitle(mainWindow);
       }
       return result;
     });
   
     // Categories and Locations (return empty arrays, no need to require project)
     ipcMain.handle('api:get-categories', async () => {
       if (!projectState.isOpen) return [];
       return projectState.manager!.getCategories();
     });
   
     ipcMain.handle('api:get-locations', async () => {
       if (!projectState.isOpen) return [];
       return projectState.manager!.getLocations();
     });
   }
   ```

3. **Update preload script with direct IPC methods**
   ```typescript
   // src/main/preload.ts - Expose direct IPC methods
   import { contextBridge, ipcRenderer } from 'electron';
   
   contextBridge.exposeInMainWorld('electronAPI', {
     // Project operations
     getCurrentProject: () => ipcRenderer.invoke('project:get-current'),
     closeProject: () => ipcRenderer.invoke('project:close'),
     saveProject: (updates?: any) => ipcRenderer.invoke('project:save', updates),
     markProjectDirty: () => ipcRenderer.invoke('project:mark-dirty'),
     
     // Product operations  
     getProducts: (filters?: any) => ipcRenderer.invoke('api:get-products', filters),
     createProduct: (data: any) => ipcRenderer.invoke('api:create-product', data),
     updateProduct: (id: string, data: any) => ipcRenderer.invoke('api:update-product', id, data),
     deleteProduct: (id: string) => ipcRenderer.invoke('api:delete-product', id),
     
     // Categories and locations
     getCategories: () => ipcRenderer.invoke('api:get-categories'),
     getLocations: () => ipcRenderer.invoke('api:get-locations'),
     
     // Event listeners
     onProjectChanged: (callback: (project: any) => void) => {
       ipcRenderer.on('project:changed', (event, project) => callback(project));
     },
     
     onProjectRequired: (callback: () => void) => {
       ipcRenderer.on('project:required', callback);
     },
     
     removeProjectChangedListener: () => {
       ipcRenderer.removeAllListeners('project:changed');
     },
     
     removeProjectRequiredListener: () => {
       ipcRenderer.removeAllListeners('project:required');
     }
   });
   
   // Type definitions for renderer
   declare global {
     interface Window {
       electronAPI: {
         getCurrentProject: () => Promise<any>;
         closeProject: () => Promise<void>;
         saveProject: (updates?: any) => Promise<boolean>;
         markProjectDirty: () => Promise<void>;
         getProducts: (filters?: any) => Promise<any[]>;
         createProduct: (data: any) => Promise<any>;
         updateProduct: (id: string, data: any) => Promise<any>;
         deleteProduct: (id: string) => Promise<boolean>;
         getCategories: () => Promise<any[]>;
         getLocations: () => Promise<any[]>;
         onProjectChanged: (callback: (project: any) => void) => void;
         onProjectRequired: (callback: () => void) => void;
         removeProjectChangedListener: () => void;
         removeProjectRequiredListener: () => void;
       };
     }
   }
   ```

4. **Update renderer API service to use electronAPI**
   ```typescript
   // src/renderer/services/api.ts - Replace existing API service
   class APIService {
     async get(endpoint: string, params?: any) {
       try {
         if (endpoint.includes('products')) {
           return await window.electronAPI.getProducts(params);
         } else if (endpoint.includes('categories')) {
           return await window.electronAPI.getCategories();
         } else if (endpoint.includes('locations')) {
           return await window.electronAPI.getLocations();
         }
         
         throw new Error(`Unknown endpoint: ${endpoint}`);
       } catch (error) {
         return this.handleAPIError(error);
       }
     }
   
     async post(endpoint: string, data: any) {
       try {
         if (endpoint.includes('products')) {
           const result = await window.electronAPI.createProduct(data);
           await window.electronAPI.markProjectDirty();
           return result;
         }
         
         throw new Error(`Unknown endpoint: ${endpoint}`);
       } catch (error) {
         return this.handleAPIError(error);
       }
     }
   
     async put(endpoint: string, id: string, data: any) {
       try {
         if (endpoint.includes('products')) {
           const result = await window.electronAPI.updateProduct(id, data);
           await window.electronAPI.markProjectDirty();
           return result;
         }
         
         throw new Error(`Unknown endpoint: ${endpoint}`);
       } catch (error) {
         return this.handleAPIError(error);
       }
     }
   
     async delete(endpoint: string, id: string) {
       try {
         if (endpoint.includes('products')) {
           const result = await window.electronAPI.deleteProduct(id);
           if (result) await window.electronAPI.markProjectDirty();
           return result;
         }
         
         throw new Error(`Unknown endpoint: ${endpoint}`);
       } catch (error) {
         return this.handleAPIError(error);
       }
     }
   
     private handleAPIError(error: any) {
       if (error.message?.includes('Please open or create a project first')) {
         // Error already handled by IPC event, just re-throw
         throw error;
       }
       
       console.error('API Error:', error);
       throw error;
     }
   }
   
   export const api = new APIService();
   ```
   
5. **Add project status management in renderer**
   ```typescript
   // src/renderer/hooks/useProject.ts - Optional project status hook
   import { useState, useEffect } from 'react';
   
   export function useProject() {
     const [project, setProject] = useState(null);
     const [isOpen, setIsOpen] = useState(false);
   
     useEffect(() => {
       // Get initial project state
       window.electronAPI.getCurrentProject().then(projectInfo => {
         setProject(projectInfo.project);
         setIsOpen(projectInfo.isOpen);
       });
   
       // Listen for project changes
       const handleProjectChanged = (newProject: any) => {
         setProject(newProject);
         setIsOpen(!!newProject);
       };
   
       window.electronAPI.onProjectChanged(handleProjectChanged);
   
       return () => {
         window.electronAPI.removeProjectChangedListener();
       };
     }, []);
   
     return { project, isOpen };
   }
   ```
   
6. **Integrate "project required" dialog with useProject hook**
   ```typescript
   // Complete src/renderer/hooks/useProject.ts - Add dialog state
   export function useProject() {
     const [project, setProject] = useState(null);
     const [isOpen, setIsOpen] = useState(false);
     const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
     const [showProjectRequired, setShowProjectRequired] = useState(false);

     useEffect(() => {
       // Get initial project state
       window.electronAPI.getCurrentProject().then(projectInfo => {
         setProject(projectInfo.project);
         setIsOpen(projectInfo.isOpen);
         setHasUnsavedChanges(projectInfo.hasUnsavedChanges);
       });

       // Listen for project changes
       const handleProjectChanged = (projectInfo: any) => {
         setProject(projectInfo.project);
         setIsOpen(projectInfo.isOpen);
         setHasUnsavedChanges(projectInfo.hasUnsavedChanges);
         setShowProjectRequired(false); // Hide dialog when project opens
       };

       // Listen for "project required" events
       const handleProjectRequired = () => {
         setShowProjectRequired(true);
       };

       window.electronAPI.onProjectChanged(handleProjectChanged);
       window.electronAPI.onProjectRequired(handleProjectRequired);

       return () => {
         window.electronAPI.removeProjectChangedListener();
         window.electronAPI.removeProjectRequiredListener();
       };
     }, []);

     const dismissProjectRequired = () => {
       setShowProjectRequired(false);
     };

     return { 
       project, 
       isOpen, 
       hasUnsavedChanges,
       showProjectRequired, 
       dismissProjectRequired 
     };
   }
   ```
   
   ```typescript
   // src/renderer/components/ProjectRequiredDialog.tsx - Modal dialog
   import React from 'react';
   
   interface ProjectRequiredDialogProps {
     isOpen: boolean;
     onClose: () => void;
   }
   
   export function ProjectRequiredDialog({ isOpen, onClose }: ProjectRequiredDialogProps) {
     if (!isOpen) return null;
   
     return (
       <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
         <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
           <h2 className="text-xl font-semibold mb-4">Project Required</h2>
           <p className="text-gray-600 mb-6">
             You need to open or create a project before you can manage products.
             Use the File menu to create a new project or open an existing one.
           </p>
           
           <div className="flex justify-end space-x-3">
             <button
               onClick={onClose}
               className="px-4 py-2 text-gray-600 hover:text-gray-800"
             >
               OK
             </button>
           </div>
         </div>
       </div>
     );
   }
   ```

### Validation:
- [ ] All existing `api.get()`, `api.post()`, etc. calls work unchanged
- [ ] Products CRUD operations work with open project
- [ ] Categories and locations populate correctly
- [ ] "Project Required" dialog appears when API calls fail due to no project
- [ ] Dialog automatically dismisses when project is opened
- [ ] Users can dismiss dialog and try again later
- [ ] Window title updates automatically on data changes (dirty state)
- [ ] No frontend code changes required for existing components
- [ ] Data format matches exactly
- [ ] Categories/locations return empty arrays gracefully when no project

---

## Phase 4: Asset Management System (Days 9-10)
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