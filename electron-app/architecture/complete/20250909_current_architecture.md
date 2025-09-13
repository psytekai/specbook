# Current Architecture Analysis

## Overview

The current system is an Electron desktop application with a React frontend that manages projects and products for specification book creation. It currently operates with mock APIs and localStorage persistence, designed to eventually integrate with a backend service.

## Frontend Architecture (Electron App)

### Application Structure
```
electron-app/src/
├── main/                    # Electron main process
│   ├── index.ts            # Main process entry point
│   └── preload.ts          # Context bridge for IPC
├── renderer/               # React application (renderer process)
│   ├── App.tsx            # Root component
│   ├── Router.tsx         # React Router configuration
│   ├── main.tsx           # React application entry
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React Context providers
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Page components
│   ├── services/          # API service layer
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
└── shared/                # Shared types between main/renderer
    └── types.ts           # Electron API interface
```

### Data Models

#### Project Entity
```typescript
interface Project {
  id: string;                // Unique identifier
  name: string;             // Project name
  description?: string;     // Optional description
  status?: string;          // Project status
  productCount: number;     // Number of products in project
  createdAt: Date;         // Creation timestamp
  updatedAt: Date;         // Last modification timestamp
}
```

#### Product Entity
```typescript
interface Product {
  id: string;                      // Unique identifier
  projectId: string;               // Parent project reference
  url: string;                     // Source URL for scraping
  tagId: string;                   // User-defined tag/identifier
  location: string[];              // Multi-select locations
  image: string;                   // Primary product image
  images: string[];                // Additional product images
  description: string;             // Product description
  specificationDescription: string; // Technical specifications
  category: string | string[];     // Product category(ies)
  product_name?: string;           // Extracted product name
  manufacturer?: string;           // Manufacturer name
  price?: number;                  // Product price
  custom_image_url?: string;       // User-uploaded custom image
  createdAt: Date;                // Creation timestamp
  updatedAt: Date;                // Last modification timestamp
}
```

#### Reference Data
```typescript
interface Location {
  id: string;
  name: string;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  createdAt: string;
}
```

### State Management

#### React Context Architecture
The application uses React Context API for global state management:

**ProjectContext** (`src/renderer/contexts/ProjectContext.tsx`):
- Manages projects list and current project selection
- Handles product management within projects
- Provides CRUD operations for projects and products
- Persists to localStorage as fallback

**State Structure:**
```typescript
interface ProjectState {
  projects: Project[];        // All projects
  currentProject: Project | null;  // Currently selected project
  products: Product[];       // Products for current project
}
```

**Actions:**
- `LOAD_PROJECTS` - Load projects from API/localStorage
- `ADD_PROJECT` - Add new project
- `UPDATE_PROJECT` - Update existing project
- `SELECT_PROJECT` - Set current project
- `ADD_PRODUCT` - Add product to current project
- `LOAD_PRODUCTS` - Load products for project

### API Service Layer

#### Mock API Implementation
**File:** `src/renderer/services/api.ts`

The current API service provides a complete mock backend that simulates:

**REST API Patterns:**
```typescript
// Project management
GET /api/projects                    // List with pagination
POST /api/projects                   // Create new project
GET /api/projects/:id                // Get project details
PUT /api/projects/:id                // Update project
DELETE /api/projects/:id             // Delete project

// Product management  
GET /api/projects/:id/products       // List products with filters
POST /api/products                   // Create product
GET /api/products/:id                // Get product details
PUT /api/products/:id                // Update product
DELETE /api/products/:id             // Delete product

// Reference data
GET /api/locations                   // List locations
POST /api/locations                  // Add location
GET /api/categories                  // List categories
POST /api/categories                 // Add category
```

**Special Operations:**
```typescript
api.scrape(request)                  // Web scraping simulation
```

#### Data Persistence Strategy
1. **Primary:** Mock API with in-memory storage
2. **Fallback:** localStorage for persistence across sessions
3. **Sync:** ProjectContext syncs between API and localStorage

### User Interface Architecture

#### Page Components
- **ProjectsPage**: Project listing and management
- **ProjectPage**: Individual project view with products
- **ProductPage**: Product details and editing
- **ProductNew**: Product creation with URL scraping

#### Key UI Patterns
1. **CRUD Operations**: Standard create/read/update/delete workflows
2. **Multi-select Components**: LocationMultiSelect, CategoryMultiSelect
3. **Async Operations**: Loading states for API calls and scraping
4. **Toast Notifications**: User feedback for operations
5. **Form Validation**: Input validation with error handling

### Integration with Python Library

The Electron app is designed to integrate with the existing Python library (`lib/`) for:

#### Web Scraping Pipeline
```python
# Expected integration pattern
from lib.core import StealthScraper, HTMLProcessor, LLMInvocator

# Current mock simulates this workflow:
scraper = StealthScraper()
result = await scraper.scrape_url(url)
processed = HTMLProcessor().process(result)
extracted = LLMInvocator().extract_product_data(processed)
```

#### Data Processing Chain
1. **Input**: Product URL from user
2. **Scraping**: Extract HTML content
3. **Processing**: Clean and structure HTML
4. **Extraction**: LLM-powered product data extraction
5. **Storage**: Save extracted data to project

## Current Data Flow

### Project Lifecycle
```
User Action → UI Component → ProjectContext → API Service → Mock Storage
                                    ↓
                            localStorage (persistence)
```

### Product Creation Flow
```
1. User enters product URL
2. ProductNew component calls api.scrape()
3. Mock scraping returns product data
4. User reviews/edits scraped data  
5. Form submission calls api.post('/products')
6. Product added to project
7. ProjectContext updates state
8. UI reflects new product
```

### State Synchronization
```
App Launch:
  1. Load from API (mock data)
  2. Fallback to localStorage if API fails
  3. Sync ProjectContext state
  4. Restore last selected project

Runtime:
  1. All operations update API (in-memory)
  2. ProjectContext reflects changes
  3. localStorage updated for persistence
```

## Current Limitations

### Data Persistence
- **No Real Backend**: Everything is mock/localStorage
- **Data Loss Risk**: localStorage can be cleared
- **No Sharing**: Projects are local to single machine
- **No Backup**: No automatic backup mechanism

### Scalability Issues
- **Memory Limits**: All data loaded into memory
- **No Pagination**: Products loaded all at once
- **Performance**: Large projects could be slow

### File Management
- **No File Operations**: No save/open/export capabilities
- **No Project Files**: Projects exist only as data structures
- **No Version Control**: No project versioning or history
- **No Portability**: Can't move projects between machines

### Integration Gaps
- **Python Lib**: Not actually connected to scraping pipeline
- **Asset Management**: No proper file handling for images
- **Search/Filter**: Limited search capabilities

## Technical Debt

### Frontend Issues
1. **Hard-coded Mock Data**: Scattered throughout codebase
2. **Error Handling**: Inconsistent error handling patterns
3. **Type Safety**: Some type assertions and any types
4. **Component Coupling**: Some tight coupling between components

### Architecture Issues
1. **No Backend Strategy**: Unclear path from mock to real backend
2. **State Management**: Context getting complex for larger datasets
3. **Asset Handling**: Images stored as URLs, no local storage
4. **Configuration**: Hard-coded configuration values

### Development Issues
1. **Build Process**: Some warnings in build pipeline
2. **Testing**: Limited test coverage
3. **Documentation**: Missing API documentation
4. **DevOps**: No CI/CD pipeline defined

## Strengths of Current Architecture

### Well-Structured Frontend
- Clean separation of concerns
- Proper TypeScript usage
- Good component architecture
- Consistent UI patterns

### Extensible Design
- Modular service layer
- Context-based state management
- Configurable API endpoints
- Reusable components

### User Experience
- Intuitive interface design
- Responsive UI with loading states
- Good error handling and feedback
- Consistent design system

### Integration Ready
- Designed for backend integration
- Proper API abstractions
- Async operation handling
- Extensible data models

## Migration Requirements

To move from current architecture to file-based desktop application:

### Backend Requirements
1. **API Compatibility**: Must maintain existing REST API patterns
2. **File Operations**: Add file-based project management
3. **Data Migration**: Handle transition from localStorage to files
4. **Performance**: Ensure file operations are fast enough for UI

### Frontend Requirements
1. **Zero Changes**: Existing components should work unchanged
2. **File Menu**: Add standard desktop file operations
3. **Project Loading**: Handle project opening/closing states
4. **Error Handling**: Handle file system errors gracefully

### Integration Requirements
1. **Python Lib**: Connect to actual scraping pipeline
2. **Asset Management**: Proper file storage for images
3. **Search/Index**: Add project indexing and search
4. **Backup/Recovery**: Implement project backup strategies