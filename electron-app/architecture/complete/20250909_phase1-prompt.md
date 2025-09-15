# Phase 1: Project File Manager Core Implementation

## Context
I'm transforming an Electron + React application to use file-based storage with `.specbook` project directories instead of a centralized database. The goal is to maintain 100% frontend compatibility while creating a true desktop application experience.

## Current Architecture
- Electron app with React frontend
- Mock API that returns product data
- Products have this structure: `{ id, projectId, url, tagId, location[], images[], description, category[], product_name, manufacturer, price, etc. }`
- Frontend uses `api.get()` and `api.post()` patterns

## Target Architecture
- Projects stored as `.specbook` directories containing:
  - `manifest.json` (project metadata)
  - `project.db` (SQLite database)
  - `assets/` folder for images
  - `.metadata/` for app settings

## Task: Implement ProjectFileManager Class

Create `src/main/services/ProjectFileManager.ts` with the following functionality:

### 1. Project Structure Creation
```typescript
class ProjectFileManager {
  // Create a new .specbook directory with all required subdirectories
  async createProjectStructure(projectPath: string): Promise<void>

  // Initialize SQLite database with correct schema
  async initializeDatabase(projectPath: string): Promise<Database>

  // Create and save manifest.json
  async createManifest(projectPath: string, projectData: any): Promise<void>
}
```

### 2. Database Schema
The SQLite database should have these tables:
```sql
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    url TEXT NOT NULL,
    tagId TEXT,
    location TEXT,            -- JSON array
    image TEXT,               
    images TEXT,              -- JSON array
    description TEXT,
    specificationDescription TEXT,
    category TEXT,            -- JSON array
    product_name TEXT,
    manufacturer TEXT,
    price REAL,
    custom_image_url TEXT,
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
```

### 3. CRUD Operations
Implement these methods that match the current API's data format exactly:

```typescript
async getProducts(filters?: { category?: string; location?: string }): Promise<Product[]>
async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>
async updateProduct(id: string, updates: Partial<Product>): Promise<Product>
async deleteProduct(id: string): Promise<boolean>
async getCategories(): Promise<Category[]>
async getLocations(): Promise<Location[]>
```

### 4. Project Operations
```typescript
async createProject(projectPath: string, projectName: string): Promise<Project>
async openProject(projectPath: string): Promise<Project>
async saveProject(updates: Partial<Project>): Promise<boolean>
async closeProject(): Promise<boolean>
```

### 5. Important Requirements
- Use `better-sqlite3` for database operations
- Maintain exact data format compatibility with current API
- JSON fields (location, images, category) must be parsed/stringified correctly
- Generate UUIDs for new IDs
- Track currentProject state internally
- Handle errors gracefully
- Ensure atomic operations where appropriate
- Use TypeScript with proper types

### 6. Manifest Structure
```json
{
  "version": "1.0.0",
  "format": "specbook-project",
  "created": "2025-01-01T00:00:00Z",
  "modified": "2025-01-01T12:30:00Z",
  "project": {
    "id": "uuid-here",
    "name": "Project Name",
    "description": "Description",
    "productCount": 0
  }
}
```

### 7. Example Usage
The service should work like this:
```typescript
const manager = new ProjectFileManager();

// Create new project
const project = await manager.createProject('./MyProject.specbook', 'My Project');

// Add a product
const product = await manager.createProduct({
  projectId: project.id,
  url: 'https://example.com/product',
  product_name: 'Test Product',
  location: ['Living Room'],
  category: ['Furniture'],
  images: [],
  price: 299.99
});

// Get all products
const products = await manager.getProducts();

// Close project
await manager.closeProject();
```

## Additional Files Needed

### 1. Type Definitions
Create `src/main/types/project.types.ts`:
```typescript
export interface Project {
  id: string;
  name: string;
  description?: string;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId?: string;
  location: string[];
  image?: string;
  images: string[];
  description?: string;
  specificationDescription?: string;
  category: string[];
  product_name: string;
  manufacturer?: string;
  price?: number;
  custom_image_url?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Location {
  id: string;
  name: string;
  createdAt: Date;
}
```

### 2. Test Script
Create `src/main/services/test-project-manager.ts` to validate the implementation:
```typescript
// Test script that creates a project, adds products, queries them, and validates the structure
```

## Success Criteria
- [ ] Can create valid `.specbook` directory structure
- [ ] Database schema matches specification exactly
- [ ] CRUD operations return data in exact same format as current API
- [ ] JSON fields are properly handled (parsed/stringified)
- [ ] Manifest file is created and updated correctly
- [ ] Error handling prevents data corruption
- [ ] TypeScript types are properly defined
- [ ] All methods are async and handle errors

## Notes
- Don't worry about IPC or frontend integration yet - just make the service work standalone
- Focus on data format compatibility - the frontend must not need any changes
- Use transactions for multi-step operations
- Include helpful error messages for debugging
- Add JSDoc comments for all public methods

Please implement this ProjectFileManager service with all the requirements above. Make sure the code is production-ready with proper error handling and TypeScript types.