# Migration Strategy: From Mock API to File-Based Desktop App

## Overview

This document outlines the step-by-step migration from the current mock API-based Electron application to a file-based desktop application. The strategy ensures zero downtime, maintains frontend compatibility, and provides a clear rollback path.

## Migration Phases

### Phase 1: Foundation Setup (Week 1-2)

#### Objectives
- Set up file-based project infrastructure
- Create basic file operations without affecting current functionality
- Establish testing framework for file operations

#### Tasks

**1.1 Project Structure Setup**
```bash
# Add new directories
electron-app/src/main/services/     # File management services
electron-app/src/main/handlers/     # IPC handlers  
electron-app/src/main/utils/        # Utility functions
electron-app/src/main/types/        # Main process types
```

**1.2 Core Services Implementation**
```typescript
// src/main/services/ProjectFileManager.ts
class ProjectFileManager {
  // Basic file operations
  async createProjectStructure(path: string): Promise<void>
  async validateProjectStructure(path: string): Promise<boolean>  
  async loadManifest(path: string): Promise<ProjectManifest>
  async saveManifest(path: string, manifest: ProjectManifest): Promise<void>
}

// src/main/services/DatabaseManager.ts
class DatabaseManager {
  // SQLite operations
  async initializeDatabase(projectPath: string): Promise<Database>
  async migrateDatabase(db: Database, fromVersion: string, toVersion: string): Promise<void>
  async validateDatabase(db: Database): Promise<ValidationResult>
}
```

**1.3 IPC Handler Framework**
```typescript
// src/main/handlers/fileHandlers.ts  
import { ipcMain } from 'electron';

ipcMain.handle('file:create-project', createProjectHandler);
ipcMain.handle('file:open-project', openProjectHandler);  
ipcMain.handle('file:save-project', saveProjectHandler);
// ... additional handlers
```

**1.4 Testing Setup**
```typescript
// tests/file-operations.test.ts
describe('Project File Operations', () => {
  test('creates valid project structure', () => { /* */ });
  test('loads existing project correctly', () => { /* */ });
  test('handles corrupted project files', () => { /* */ });
});
```

#### Success Criteria
- [ ] Can create `.specbook` directory structure
- [ ] Can initialize SQLite database with correct schema  
- [ ] Can read/write manifest files
- [ ] Basic IPC handlers respond correctly
- [ ] All tests pass
- [ ] Current app functionality unchanged

---

### Phase 2: File Menu Integration (Week 3)

#### Objectives
- Add standard desktop file menu
- Implement file dialogs for project operations
- Enable basic project file operations alongside current functionality

#### Tasks

**2.1 Menu System Implementation**
```typescript
// src/main/menu.ts
import { Menu, MenuItem } from 'electron';

const fileMenu = {
  label: 'File',
  submenu: [
    { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: handleNewProject },
    { label: 'Open Project...', accelerator: 'CmdOrCtrl+O', click: handleOpenProject },
    { type: 'separator' },
    { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: handleSaveProject },
    { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: handleSaveAs },
    { type: 'separator' },
    { label: 'Recent Projects', submenu: buildRecentProjectsMenu() },
    { type: 'separator' },
    { label: 'Close Project', accelerator: 'CmdOrCtrl+W', click: handleCloseProject }
  ]
};
```

**2.2 File Dialog Handlers**
```typescript  
// src/main/handlers/fileDialogs.ts
async function showNewProjectDialog(): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: 'Create New Project',
    defaultPath: 'Untitled Project.specbook',
    filters: [{ name: 'Specbook Projects', extensions: ['specbook'] }],
    properties: ['createDirectory']
  });
  
  return result.canceled ? null : result.filePath;
}

async function showOpenProjectDialog(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Open Project',  
    filters: [{ name: 'Specbook Projects', extensions: ['specbook'] }],
    properties: ['openDirectory']
  });
  
  return result.canceled ? null : result.filePaths[0];
}
```

**2.3 Recent Projects Management**
```typescript
// src/main/services/RecentProjectsManager.ts
class RecentProjectsManager {
  private recentProjects: RecentProject[] = [];
  
  addRecentProject(filePath: string, projectName: string): void
  getRecentProjects(): RecentProject[]
  removeRecentProject(filePath: string): void
  buildRecentProjectsMenu(): MenuItem[]
}
```

**2.4 Project State Management** 
```typescript
// src/main/services/ProjectStateManager.ts
class ProjectStateManager {
  private openProjects = new Map<string, OpenProject>();
  
  openProject(filePath: string): Promise<Project>
  closeProject(projectId: string): Promise<void>
  getCurrentProject(): OpenProject | null
  isProjectOpen(filePath: string): boolean
}
```

#### Success Criteria
- [ ] File menu appears with all options
- [ ] New Project dialog creates `.specbook` directory
- [ ] Open Project dialog opens existing `.specbook` directories
- [ ] Save operations work on current project
- [ ] Recent projects menu populates correctly
- [ ] Keyboard shortcuts work
- [ ] Current mock API functionality still works

---

### Phase 3: API Bridge Implementation (Week 4-5)

#### Objectives  
- Replace mock HTTP API calls with IPC calls to file operations
- Maintain exact same API interfaces for frontend
- Ensure all existing frontend functionality works with file backend

#### Tasks

**3.1 IPC API Handlers**
```typescript
// src/main/handlers/apiHandlers.ts
ipcMain.handle('api:get-projects', async () => {
  const stateManager = ProjectStateManager.getInstance();
  const openProjects = stateManager.getAllOpenProjects();
  return openProjects.map(p => p.project);
});

ipcMain.handle('api:get-products', async (event, params) => {
  const project = ProjectStateManager.getInstance().getCurrentProject();
  if (!project) throw new Error('No project open');
  
  return await project.fileManager.getProducts(params);
});

ipcMain.handle('api:create-product', async (event, productData) => {
  const project = ProjectStateManager.getInstance().getCurrentProject();
  if (!project) throw new Error('No project open');
  
  return await project.fileManager.createProduct(productData);
});

// ... additional API handlers
```

**3.2 Preload API Bridge**
```typescript
// src/main/preload.ts - EXPANDED
contextBridge.exposeInMainWorld('electronAPI', {
  // Existing platform info
  platform: process.platform,
  
  // File operations
  newProject: () => ipcRenderer.invoke('file:new-project'),
  openProject: () => ipcRenderer.invoke('file:open-project'),
  saveProject: (data: any) => ipcRenderer.invoke('file:save-project', data),
  closeProject: () => ipcRenderer.invoke('file:close-project'),
  
  // API operations (maintain compatibility)
  getProjects: (params?: any) => ipcRenderer.invoke('api:get-projects', params),
  getProducts: (params?: any) => ipcRenderer.invoke('api:get-products', params), 
  createProduct: (data: any) => ipcRenderer.invoke('api:create-product', data),
  updateProduct: (id: string, data: any) => ipcRenderer.invoke('api:update-product', id, data),
  deleteProduct: (id: string) => ipcRenderer.invoke('api:delete-product', id),
  
  getLocations: () => ipcRenderer.invoke('api:get-locations'),
  createLocation: (data: any) => ipcRenderer.invoke('api:create-location', data),
  getCategories: () => ipcRenderer.invoke('api:get-categories'),
  createCategory: (data: any) => ipcRenderer.invoke('api:create-category', data),
});
```

**3.3 Renderer API Service Update**
```typescript
// src/renderer/services/api.ts - MODIFIED
// Replace HTTP calls with IPC calls while maintaining same interface

export const api = {
  async get<T>(endpoint: string, params?: any): Promise<ApiResponse<T>> {
    // Route endpoints to IPC calls
    switch (endpoint) {
      case '/api/projects':
        const projects = await window.electronAPI.getProjects(params);
        return { success: true, data: projects };
        
      case '/api/locations':
        const locations = await window.electronAPI.getLocations();
        return { success: true, data: locations };
        
      case '/api/categories':
        const categories = await window.electronAPI.getCategories();
        return { success: true, data: categories };
        
      default:
        if (endpoint.includes('/products')) {
          const products = await window.electronAPI.getProducts(params);
          return { success: true, data: products };
        }
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
  },
  
  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    switch (endpoint) {
      case '/api/products':
        const product = await window.electronAPI.createProduct(data);
        return { success: true, data: product };
        
      case '/api/locations':
        const location = await window.electronAPI.createLocation(data);
        return { success: true, data: location };
        
      case '/api/categories':
        const category = await window.electronAPI.createCategory(data);
        return { success: true, data: category };
        
      default:
        throw new Error(`Unknown POST endpoint: ${endpoint}`);
    }
  },
  
  // ... put, delete methods
  
  // Scraping integration (placeholder for Phase 4)
  async scrape(request: any) {
    return await window.electronAPI.scrapeProduct(request);
  }
};
```

**3.4 Project Loading Integration**
```typescript
// src/renderer/contexts/ProjectContext.tsx - MINIMAL CHANGES
// Update only the data loading logic

const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  
  useEffect(() => {
    const loadProjects = async () => {
      try {
        // Use existing API interface - now calls IPC instead of HTTP
        const response = await api.get<Project[]>('/api/projects');
        dispatch({ type: 'LOAD_PROJECTS', payload: response.data });
      } catch (error) {
        console.warn('Failed to load projects:', error);
        // Fallback to localStorage if needed
      }
    };
    
    loadProjects();
  }, []);
  
  // Rest of component unchanged
};
```

#### Success Criteria
- [ ] All existing API calls work through IPC
- [ ] Frontend components work unchanged
- [ ] Project/product CRUD operations function correctly
- [ ] Data persists to `.specbook` files
- [ ] Error handling works appropriately
- [ ] Performance is acceptable
- [ ] No regressions in existing functionality

---

### Phase 4: Python Integration & Scraping (Week 6)

#### Objectives
- Integrate with existing Python lib for web scraping
- Replace mock scraping with real scraping pipeline
- Handle async operations and progress reporting

#### Tasks

**4.1 Python Scraping Service**
```typescript
// src/main/services/ScrapingService.ts
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

class ScrapingService {
  private pythonPath: string;
  
  constructor() {
    // Path to parent directory's Python lib
    this.pythonPath = path.resolve(__dirname, '../../../');
  }
  
  async scrapeProduct(request: ScrapeRequest): Promise<ScrapeResult> {
    const scriptPath = path.join(this.pythonPath, 'workspace/scripts/single_product_scrape.py');
    
    return new Promise((resolve, reject) => {
      const args = [
        scriptPath,
        '--url', request.url,
        '--tag-id', request.tagId,
        '--location', request.location,
        '--output-format', 'json'
      ];
      
      const pythonProcess = spawn('python', args, {
        cwd: this.pythonPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        // Emit progress events if needed
        this.emitProgress(data.toString());
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse scraping result: ${error}`));
          }
        } else {
          reject(new Error(`Scraping failed (code ${code}): ${stderr}`));
        }
      });
    });
  }
  
  private emitProgress(output: string) {
    // Parse progress from Python script output
    // Emit to renderer via IPC if needed
  }
}
```

**4.2 Python Script Integration**
```python
# workspace/scripts/single_product_scrape.py
import argparse
import json
import sys
from pathlib import Path

# Add lib to path
sys.path.append(str(Path(__file__).parent.parent.parent / 'lib'))

from lib.core import StealthScraper, HTMLProcessor, LLMInvocator
from lib.monitoring import PipelineMonitor

def main():
    parser = argparse.ArgumentParser(description='Scrape product data')
    parser.add_argument('--url', required=True, help='Product URL')
    parser.add_argument('--tag-id', required=True, help='Tag ID')
    parser.add_argument('--location', required=True, help='Location')
    parser.add_argument('--output-format', default='json', help='Output format')
    
    args = parser.parse_args()
    
    try:
        # Initialize services
        monitor = PipelineMonitor()
        scraper = StealthScraper()
        processor = HTMLProcessor()
        llm = LLMInvocator()
        
        # Scrape URL
        print("Starting scraping...", file=sys.stderr)
        scrape_result = scraper.scrape_url(args.url)
        
        # Process HTML
        print("Processing HTML...", file=sys.stderr) 
        processed = processor.process(scrape_result.html)
        
        # Extract product data
        print("Extracting product data...", file=sys.stderr)
        extracted = llm.extract_product_data(processed, {
            'url': args.url,
            'tag_id': args.tag_id,
            'location': args.location
        })
        
        # Format result for Electron
        result = {
            'success': True,
            'data': {
                'product_image': extracted.image_url,
                'product_images': extracted.additional_images,
                'product_description': extracted.description,
                'specification_description': extracted.specifications,
                'category': extracted.categories,
                'product_name': extracted.name,
                'manufacturer': extracted.manufacturer,
                'price': extracted.price
            }
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()
```

**4.3 IPC Scraping Handler**
```typescript
// src/main/handlers/scrapingHandlers.ts
ipcMain.handle('scrape:product', async (event, request) => {
  const scrapingService = new ScrapingService();
  
  try {
    const result = await scrapingService.scrapeProduct(request);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});
```

#### Success Criteria
- [ ] Python scraping script runs from Electron
- [ ] Real product data extracted from URLs
- [ ] Error handling for scraping failures
- [ ] Progress reporting works (if implemented)
- [ ] Integration with existing lib/ functionality
- [ ] Performance acceptable for user experience

---

### Phase 5: Asset Management (Week 7)

#### Objectives
- Implement content-addressable asset storage
- Handle image uploads and thumbnails
- Manage asset references in database

#### Tasks

**5.1 Asset Manager Service**
```typescript
// src/main/services/AssetManager.ts
import * as crypto from 'crypto';
import * as sharp from 'sharp';

class AssetManager {
  async storeAsset(projectPath: string, buffer: Buffer, originalName: string): Promise<string> {
    // Calculate hash
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Determine storage path
    const ext = path.extname(originalName);
    const filename = `sha256_${hash}${ext}`;
    const mimeType = this.getMimeType(originalName);
    const subdir = mimeType.startsWith('image/') ? 'images' : 'documents';
    const assetPath = path.join(projectPath, 'assets', subdir, filename);
    
    // Store if not exists (deduplication)
    if (!await this.fileExists(assetPath)) {
      await fs.mkdir(path.dirname(assetPath), { recursive: true });
      await fs.writeFile(assetPath, buffer);
      
      // Generate thumbnails for images
      if (mimeType.startsWith('image/')) {
        await this.generateThumbnails(assetPath, hash, projectPath);
      }
      
      // Record in database
      await this.recordAsset(projectPath, hash, originalName, mimeType, buffer.length);
    }
    
    return hash;
  }
  
  async getAssetPath(projectPath: string, hash: string): Promise<string | null> {
    // Search for asset file by hash
    const subdirs = ['images', 'documents'];
    
    for (const subdir of subdirs) {
      const assetDir = path.join(projectPath, 'assets', subdir);
      try {
        const files = await fs.readdir(assetDir);
        const matchingFile = files.find(f => f.includes(hash));
        if (matchingFile) {
          return path.join(assetDir, matchingFile);
        }
      } catch {
        // Directory doesn't exist
      }
    }
    
    return null;
  }
  
  private async generateThumbnails(assetPath: string, hash: string, projectPath: string) {
    const thumbnailDir = path.join(projectPath, 'assets', 'thumbnails');
    await fs.mkdir(thumbnailDir, { recursive: true });
    
    const sizes = [128, 256, 512];
    
    for (const size of sizes) {
      const thumbnailPath = path.join(thumbnailDir, `sha256_${hash}_${size}.jpg`);
      
      await sharp(assetPath)
        .resize(size, size, { 
          fit: 'inside', 
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 85 })
        .toFile(thumbnailPath);
    }
  }
}
```

**5.2 Asset Upload Handler**
```typescript
// src/main/handlers/assetHandlers.ts
ipcMain.handle('asset:upload', async (event, fileData: ArrayBuffer, originalName: string) => {
  const projectState = ProjectStateManager.getInstance().getCurrentProject();
  if (!projectState) {
    throw new Error('No project open');
  }
  
  const buffer = Buffer.from(fileData);
  const assetManager = new AssetManager();
  
  const hash = await assetManager.storeAsset(
    projectState.filePath,
    buffer,
    originalName
  );
  
  return {
    success: true,
    hash,
    originalName,
    size: buffer.length
  };
});

ipcMain.handle('asset:get-path', async (event, hash: string) => {
  const projectState = ProjectStateManager.getInstance().getCurrentProject();
  if (!projectState) {
    return null;
  }
  
  const assetManager = new AssetManager();
  return await assetManager.getAssetPath(projectState.filePath, hash);
});
```

**5.3 Frontend Asset Integration**
```typescript
// src/renderer/components/FileUpload/FileUpload.tsx - MINIMAL CHANGES
const FileUpload: React.FC<FileUploadProps> = ({ onUpload }) => {
  const handleFileUpload = async (file: File) => {
    try {
      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Upload via IPC (instead of HTTP)
      const result = await window.electronAPI.uploadAsset(arrayBuffer, file.name);
      
      if (result.success) {
        onUpload(result.hash, file.name);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };
  
  // Rest of component unchanged
};
```

#### Success Criteria
- [ ] Image uploads work correctly
- [ ] Assets stored with content-addressable naming
- [ ] Thumbnails generated automatically
- [ ] Asset deduplication works
- [ ] Asset references in database correct
- [ ] Frontend displays assets correctly

---

### Phase 6: Final Integration & Polish (Week 8)

#### Objectives
- Complete end-to-end testing
- Performance optimization
- Error handling improvements
- Documentation updates

#### Tasks

**6.1 End-to-End Testing**
```typescript
// tests/e2e/full-workflow.test.ts
describe('Complete Workflow', () => {
  test('new project → add product → save → reopen', async () => {
    // Create new project
    const project = await createTestProject();
    
    // Add product with scraping
    const product = await addProductWithScraping(project, TEST_URL);
    
    // Save project
    await saveProject(project);
    
    // Close and reopen
    await closeProject(project);
    const reopened = await openProject(project.filePath);
    
    // Verify data integrity
    expect(reopened.products).toHaveLength(1);
    expect(reopened.products[0].id).toBe(product.id);
  });
});
```

**6.2 Performance Optimization**
- Database connection pooling
- Lazy loading of assets
- Thumbnail caching
- Async operation batching

**6.3 Error Recovery**
- Corrupted file detection and repair
- Backup/restore functionality
- Graceful degradation
- User-friendly error messages

**6.4 Documentation**
```markdown
# Updated User Guide
- How to create/open/save projects
- File menu operations
- Project file structure
- Backup recommendations
```

#### Success Criteria
- [ ] All existing functionality works
- [ ] File operations are reliable
- [ ] Performance meets requirements
- [ ] Error handling is robust
- [ ] Documentation is complete
- [ ] Ready for production use

## Rollback Strategy

Each phase includes rollback procedures:

### Phase 1-2 Rollback
- Disable file menu items
- Continue using mock API
- Remove file operation handlers

### Phase 3-4 Rollback  
- Restore original API service
- Disable IPC handlers
- Fall back to localStorage persistence

### Phase 5-6 Rollback
- Disable asset management
- Use original image URL handling
- Remove file-based storage

## Risk Mitigation

### Technical Risks
1. **SQLite Performance**: Benchmark with large datasets
2. **File System Issues**: Comprehensive error handling
3. **Python Integration**: Fallback to mock scraping if needed
4. **Asset Storage**: Implement cleanup and recovery tools

### User Experience Risks  
1. **Learning Curve**: Maintain familiar UI patterns
2. **Data Loss**: Implement robust backup systems
3. **Performance**: Optimize file operations for responsiveness
4. **Compatibility**: Test across all target platforms

### Project Risks
1. **Timeline**: Implement in phases with working software each sprint
2. **Scope Creep**: Focus on core functionality first
3. **Resource Allocation**: Plan for testing and documentation time

## Success Metrics

### Functionality
- [ ] 100% of current features work in file-based system
- [ ] File operations complete in <1 second
- [ ] Projects up to 1000 products load in <2 seconds
- [ ] No data loss during normal operations

### User Experience
- [ ] Zero learning curve for existing users
- [ ] Standard desktop app behavior
- [ ] Responsive UI during file operations
- [ ] Clear feedback for long-running operations

### Technical Quality
- [ ] 90%+ test coverage for new functionality
- [ ] Cross-platform compatibility maintained
- [ ] Error recovery procedures documented and tested
- [ ] Performance benchmarks established and met

This migration strategy provides a systematic approach to transitioning from the current mock API system to a robust file-based desktop application while maintaining all existing functionality and user experience.