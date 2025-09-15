# Target Architecture: File-Based Desktop Application

## Overview

The target architecture transforms the current Electron application into a true desktop application that works with `.specbook` project files. This approach maintains complete frontend compatibility while adding standard desktop file operations and eliminating the need for a traditional backend server.

## Core Principles

### 1. Zero Frontend Changes
- All existing React components work unchanged
- Same API patterns and data models
- Existing state management (ProjectContext) preserved
- No UI modifications required

### 2. Standard Desktop UX
- File → New Project, Open, Save, Save As, Close
- Projects stored as `.specbook` directories on file system
- Recently opened files in File menu
- Standard OS file dialogs

### 3. Direct File Operations
- Projects are self-contained `.specbook` directories
- No traditional backend server required
- Direct SQLite database access
- Content-addressable asset storage

## Project File Format (.specbook)

### Directory Structure
```
MyProject.specbook/
├── manifest.json           # Project metadata
├── project.db             # SQLite database (products, etc.)
├── project.db-wal         # Write-ahead log (when active)
├── project.db-shm         # Shared memory (when active)
├── assets/                # Content-addressable assets
│   ├── images/
│   │   ├── sha256_abc123...def.jpg
│   │   └── sha256_456789...xyz.png
│   └── thumbnails/        # Generated thumbnails
│       ├── sha256_abc123..._256.jpg
│       └── sha256_456789..._256.png
├── exports/               # Generated exports (PDF, etc.)
└── .metadata             # Hidden app metadata
    ├── recent_files.json  # Recently opened files
    └── user_settings.json # User preferences
```

### Manifest Format
```json
{
  "version": "1.0.0",
  "format": "specbook-project",
  "created": "2025-01-01T00:00:00Z",
  "modified": "2025-01-01T12:30:00Z",
  "project": {
    "id": "uuid-v4-string",
    "name": "My Project",
    "description": "Project description",
    "tags": ["tag1", "tag2"]
  },
  "statistics": {
    "productCount": 42,
    "assetCount": 156,
    "totalSize": 1048576
  },
  "app": {
    "lastOpened": "2025-01-01T12:30:00Z",
    "windowState": {
      "width": 1200,
      "height": 800,
      "x": 100,
      "y": 100
    }
  }
}
```

### Database Schema (project.db)
```sql
-- Same structure as current mock API expects
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,  -- Always matches parent project
    url TEXT NOT NULL,
    tagId TEXT,
    location TEXT,            -- JSON array of locations
    image TEXT,               -- Asset hash reference
    images TEXT,              -- JSON array of asset hashes
    description TEXT,
    specificationDescription TEXT,
    category TEXT,            -- JSON array of categories  
    product_name TEXT,
    manufacturer TEXT,
    price REAL,
    custom_image_url TEXT,    -- Asset hash if uploaded
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE locations (
    id TEXT PRIMARY KEY, 
    name TEXT UNIQUE NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assets (
    hash TEXT PRIMARY KEY,    -- SHA-256 hash
    original_name TEXT,
    mime_type TEXT,
    size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_products_project ON products(projectId);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_location ON products(location);
```

## Architecture Layers

### Layer 1: Electron Main Process (File Operations)

#### File Menu Integration
```typescript
// src/main/menu.ts
import { Menu, dialog } from 'electron';

const fileMenu = {
  label: 'File',
  submenu: [
    {
      label: 'New Project',
      accelerator: 'CmdOrCtrl+N',
      click: () => createNewProject()
    },
    {
      label: 'Open Project...',
      accelerator: 'CmdOrCtrl+O', 
      click: () => openProject()
    },
    {
      label: 'Save Project',
      accelerator: 'CmdOrCtrl+S',
      click: () => saveCurrentProject()
    },
    {
      label: 'Save As...',
      accelerator: 'CmdOrCtrl+Shift+S',
      click: () => saveProjectAs()
    },
    { type: 'separator' },
    {
      label: 'Recent Projects',
      submenu: getRecentProjects()
    },
    { type: 'separator' },
    {
      label: 'Close Project',
      accelerator: 'CmdOrCtrl+W',
      click: () => closeCurrentProject()
    }
  ]
};
```

#### IPC Handlers for File Operations
```typescript
// src/main/fileHandlers.ts
import { ipcMain, dialog } from 'electron';
import { ProjectFileManager } from './services/ProjectFileManager';

const projectManager = new ProjectFileManager();

ipcMain.handle('file:new-project', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Create New Project',
    defaultPath: 'Untitled Project.specbook',
    filters: [{ name: 'Specbook Projects', extensions: ['specbook'] }]
  });
  
  if (!result.canceled) {
    const project = await projectManager.createProject(result.filePath);
    return { success: true, project, filePath: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('file:open-project', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Project',
    properties: ['openDirectory'],
    filters: [{ name: 'Specbook Projects', extensions: ['specbook'] }]
  });
  
  if (!result.canceled) {
    const project = await projectManager.openProject(result.filePaths[0]);
    return { success: true, project, filePath: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('file:save-project', async (event, projectData) => {
  const success = await projectManager.saveCurrentProject(projectData);
  return { success };
});
```

### Layer 2: Project File Manager

#### Core File Management Service
```typescript
// src/main/services/ProjectFileManager.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';
import { Project, Product } from '../../../shared/types';

class ProjectFileManager {
  private currentProject: {
    filePath: string;
    project: Project;
    db: Database.Database;
  } | null = null;

  async createProject(filePath: string): Promise<Project> {
    // Create .specbook directory structure
    await this.createProjectStructure(filePath);
    
    // Initialize database
    const db = await this.initializeDatabase(filePath);
    
    // Create manifest
    const project: Project = {
      id: generateUUID(),
      name: path.basename(filePath, '.specbook'),
      productCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.saveManifest(filePath, project);
    
    this.currentProject = { filePath, project, db };
    this.addToRecentProjects(filePath);
    
    return project;
  }

  async openProject(filePath: string): Promise<Project> {
    // Validate project structure
    await this.validateProjectStructure(filePath);
    
    // Load manifest
    const manifest = await this.loadManifest(filePath);
    const project = manifest.project;
    
    // Open database
    const dbPath = path.join(filePath, 'project.db');
    const db = new Database(dbPath);
    
    // Update statistics
    project.productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    project.updatedAt = new Date();
    
    this.currentProject = { filePath, project, db };
    this.addToRecentProjects(filePath);
    
    return project;
  }

  async saveProject(projectData: Partial<Project>): Promise<boolean> {
    if (!this.currentProject) return false;
    
    // Update project metadata
    const updatedProject = {
      ...this.currentProject.project,
      ...projectData,
      updatedAt: new Date()
    };
    
    // Save manifest
    await this.saveManifest(this.currentProject.filePath, updatedProject);
    
    // Update current project
    this.currentProject.project = updatedProject;
    
    return true;
  }

  async closeProject(): Promise<boolean> {
    if (!this.currentProject) return false;
    
    // Close database connection
    this.currentProject.db.close();
    
    // Clear current project
    this.currentProject = null;
    
    return true;
  }

  // Database operations that maintain API compatibility
  async getProducts(filters?: any): Promise<Product[]> {
    if (!this.currentProject) throw new Error('No project open');
    
    let query = 'SELECT * FROM products';
    const params = [];
    
    if (filters?.category) {
      query += ' WHERE category LIKE ?';
      params.push(`%${filters.category}%`);
    }
    
    const stmt = this.currentProject.db.prepare(query);
    const rows = stmt.all(...params);
    
    return rows.map(row => ({
      ...row,
      location: JSON.parse(row.location || '[]'),
      images: JSON.parse(row.images || '[]'),
      category: JSON.parse(row.category || '[]'),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }));
  }

  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    if (!this.currentProject) throw new Error('No project open');
    
    const product: Product = {
      ...productData,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const stmt = this.currentProject.db.prepare(`
      INSERT INTO products (id, projectId, url, tagId, location, image, images, 
                          description, specificationDescription, category, 
                          product_name, manufacturer, price, custom_image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      product.id,
      product.projectId,
      product.url,
      product.tagId,
      JSON.stringify(product.location),
      product.image,
      JSON.stringify(product.images),
      product.description,
      product.specificationDescription,
      JSON.stringify(product.category),
      product.product_name,
      product.manufacturer,
      product.price,
      product.custom_image_url
    );
    
    // Update project product count
    this.currentProject.project.productCount++;
    await this.saveManifest(this.currentProject.filePath, this.currentProject.project);
    
    return product;
  }
}
```

### Layer 3: API Bridge (Zero Frontend Changes)

#### API Service Replacement
```typescript
// src/renderer/services/api.ts - MODIFIED to use IPC instead of HTTP
import { Project, Product } from '../types';

// Replace HTTP calls with IPC calls to maintain same API interface
export const api = {
  async get<T>(endpoint: string, params?: any): Promise<{ success: boolean; data: T }> {
    // Route to appropriate IPC handler
    if (endpoint === '/api/projects') {
      const projects = await window.electronAPI.getProjects();
      return { success: true, data: projects as T };
    }
    
    if (endpoint.includes('/products')) {
      const products = await window.electronAPI.getProducts(params);
      return { success: true, data: products as T };
    }
    
    // ... other endpoints
  },
  
  async post<T>(endpoint: string, data: any): Promise<{ success: boolean; data: T }> {
    if (endpoint === '/api/products') {
      const product = await window.electronAPI.createProduct(data);
      return { success: true, data: product as T };
    }
    
    // ... other endpoints
  },
  
  // Scraping integration with Python lib
  async scrape(request: any) {
    // Call Python scraping service via IPC
    const result = await window.electronAPI.scrapeProduct(request);
    return result;
  }
};
```

#### IPC Bridge
```typescript
// src/main/preload.ts - EXPANDED
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  newProject: () => ipcRenderer.invoke('file:new-project'),
  openProject: () => ipcRenderer.invoke('file:open-project'),
  saveProject: (data: any) => ipcRenderer.invoke('file:save-project', data),
  closeProject: () => ipcRenderer.invoke('file:close-project'),
  
  // Data operations (maintain API compatibility)
  getProjects: () => ipcRenderer.invoke('api:get-projects'),
  getProducts: (params: any) => ipcRenderer.invoke('api:get-products', params),
  createProduct: (data: any) => ipcRenderer.invoke('api:create-product', data),
  updateProduct: (id: string, data: any) => ipcRenderer.invoke('api:update-product', id, data),
  
  // Scraping integration
  scrapeProduct: (request: any) => ipcRenderer.invoke('scrape:product', request),
  
  // Asset management
  uploadAsset: (file: File) => ipcRenderer.invoke('asset:upload', file),
  getAssetPath: (hash: string) => ipcRenderer.invoke('asset:get-path', hash)
});
```

### Layer 4: Python Integration Service

#### Scraping Service Integration
```typescript
// src/main/services/ScrapingService.ts
import { spawn } from 'child_process';
import * as path from 'path';

class ScrapingService {
  private pythonPath: string;
  
  constructor() {
    // Path to parent directory's Python lib
    this.pythonPath = path.join(__dirname, '../../../');
  }
  
  async scrapeProduct(url: string, tagId: string, location: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Call Python scraping script
      const pythonProcess = spawn('python', [
        path.join(this.pythonPath, 'workspace/scripts/single_product_scrape.py'),
        '--url', url,
        '--tag', tagId,
        '--location', location
      ]);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse scraping result: ${error}`));
          }
        } else {
          reject(new Error(`Scraping failed: ${errorOutput}`));
        }
      });
    });
  }
}
```

### Layer 5: Asset Management

#### Content-Addressable Storage
```typescript
// src/main/services/AssetManager.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { sharp } from 'sharp'; // For image processing

class AssetManager {
  async storeAsset(projectPath: string, file: Buffer, originalName: string): Promise<string> {
    // Calculate hash
    const hash = crypto.createHash('sha256').update(file).digest('hex');
    const ext = path.extname(originalName);
    const filename = `sha256_${hash}${ext}`;
    
    // Determine asset type and subdirectory
    const mimeType = this.getMimeType(originalName);
    const subdir = mimeType.startsWith('image/') ? 'images' : 'documents';
    
    // Asset path
    const assetPath = path.join(projectPath, 'assets', subdir, filename);
    
    // Check if asset already exists (deduplication)
    try {
      await fs.access(assetPath);
      return hash; // Already exists
    } catch {
      // Doesn't exist, store it
    }
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(assetPath), { recursive: true });
    
    // Write file
    await fs.writeFile(assetPath, file);
    
    // Generate thumbnail if image
    if (mimeType.startsWith('image/')) {
      await this.generateThumbnails(assetPath, hash, projectPath);
    }
    
    return hash;
  }
  
  async getAssetPath(projectPath: string, hash: string): Promise<string | null> {
    // Search in both images and documents
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
        // Directory doesn't exist or can't read
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
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(thumbnailPath);
    }
  }
}
```

## Data Flow Architecture

### Project Lifecycle
```
User Action: File → New Project
├── 1. Electron shows save dialog
├── 2. User selects location for .specbook directory
├── 3. ProjectFileManager.createProject()
├── 4. Creates directory structure + SQLite DB
├── 5. Returns Project object
├── 6. Frontend receives project via IPC
├── 7. ProjectContext loads project (same as before)
└── 8. UI updates (no changes needed)
```

### Product Creation Flow
```
User Action: Add Product with URL
├── 1. ProductNew form submission
├── 2. api.scrape() called (same as current)
├── 3. IPC to main process scrape handler
├── 4. Python scraping service called
├── 5. Scraped data returned via IPC
├── 6. User reviews data in form (unchanged)
├── 7. api.post('/products') called (same API)
├── 8. IPC to main process create-product handler
├── 9. ProjectFileManager.createProduct()
├── 10. SQLite INSERT operation
├── 11. Asset files stored if any
├── 12. Product returned via IPC
├── 13. ProjectContext updates (unchanged)
└── 14. UI reflects new product (unchanged)
```

### File Operations Flow
```
File → Save Project (Ctrl+S)
├── 1. Menu accelerator triggers
├── 2. Current project data gathered
├── 3. ProjectFileManager.saveProject()
├── 4. Manifest updated with new timestamp
├── 5. Any pending DB operations committed
├── 6. Success notification
└── 7. Window title updated with saved state
```

## Benefits of Target Architecture

### User Experience
- **Standard Desktop App**: File operations work as expected
- **No Server Required**: Self-contained project files
- **Portable Projects**: Copy/move/share .specbook directories
- **Offline First**: No network dependency
- **Fast Performance**: Direct file access

### Developer Experience  
- **Zero Frontend Changes**: Existing components work unchanged
- **Familiar Patterns**: Standard file I/O operations
- **Easy Testing**: No complex server setup required
- **Simple Deployment**: Single Electron app executable

### Technical Benefits
- **Data Integrity**: SQLite ACID compliance
- **Version Control**: Projects can be Git-tracked
- **Backup Friendly**: Simple file/directory backup
- **Concurrent Access**: Multiple projects can be open
- **Asset Management**: Content-addressable storage prevents duplication

## Migration Strategy

### Phase 1: File Operations Layer
1. Implement ProjectFileManager service
2. Add Electron file menu integration
3. Create IPC handlers for file operations
4. Test file creation/opening/saving

### Phase 2: API Bridge Replacement
1. Replace HTTP API calls with IPC calls
2. Maintain exact same API interfaces
3. Update preload script with IPC bridge
4. Test all existing frontend functionality

### Phase 3: Python Integration
1. Create ScrapingService integration
2. Connect to existing lib/ scraping pipeline
3. Handle async operations and progress reporting
4. Test scraping functionality

### Phase 4: Asset Management
1. Implement content-addressable asset storage
2. Add image upload and thumbnail generation
3. Update asset references in database
4. Test asset handling and retrieval

### Phase 5: Polish & Optimization
1. Add error handling for file operations
2. Implement auto-save and backup features
3. Add recent projects menu
4. Performance optimization and testing

This target architecture provides a true desktop application experience while maintaining complete compatibility with the existing frontend codebase.