name: "Electron App for Architectural Product Management"
description: |

## Purpose
Build a desktop Electron application that allows users to manage architectural projects and scrape product information with a modern React-based UI.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Create a full-featured Electron desktop application that:
- Manages multiple architectural projects
- Scrapes and stores product information per project
- Provides an intuitive UI for adding/editing products
- Integrates with the existing Python backend via mocked APIs
- Packages for Mac and Windows distribution

## Why
- **User Experience**: Native desktop app provides better performance than web UI
- **Project Management**: Centralized tool for architectural product specification
- **Efficiency**: Streamlined workflow for adding products to projects
- **Cross-platform**: Works on both Mac and Windows
- **Modern Stack**: Uses latest React 19.1 with TypeScript for maintainability

## What
User-visible features:
1. Persistent sidebar navigation (Projects, Settings)
2. Project management (create, edit, list projects)
3. Product addition workflow with URL scraping
4. Editable product details with image preview
5. Error toasts for API failures
6. Hot reload development environment

### Success Criteria
- [ ] Electron app launches successfully on Mac/Windows
- [ ] All navigation routes work correctly
- [ ] Projects can be created/edited/selected
- [ ] Products can be added with mock API integration
- [ ] UI is responsive and follows design requirements
- [ ] Build creates distributable packages

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- url: https://www.electronjs.org/docs/latest/tutorial/quick-start
  why: Official Electron quick start guide with React integration
  
- url: https://vitejs.dev/guide/
  why: Vite configuration for Electron + React setup
  
- url: https://react.dev/reference/react/hooks
  why: React 19.1 hooks documentation for state management
  
- url: https://reactrouter.com/en/main/start/tutorial
  why: React Router v6 for navigation between views
  
- url: https://www.typescriptlang.org/docs/handbook/react.html
  why: TypeScript with React best practices
  
- url: https://www.electron.build/configuration/configuration
  why: Electron Builder configuration for packaging
  
- url: https://github.com/electron-userland/electron-builder/tree/master/packages/electron-builder
  why: Electron Builder examples and patterns

- file: prps/02-electron_app.md
  why: Complete feature requirements and specifications

- file: CLAUDE.md
  why: Project conventions and development commands
```

### Current Codebase Context
```bash
# The project is primarily Python-based for backend
phase1-specbook/
├── tools/              # Python scraping tools
├── verification_ui.py  # Existing Flask UI (reference for features)
├── templates/          # Flask templates (UI patterns to follow)
└── workspace/          # Data storage location
```

### Desired Project Structure
```bash
phase1-specbook/
├── electron-app/
│   ├── package.json           # Project dependencies
│   ├── tsconfig.json          # TypeScript configuration
│   ├── vite.config.ts         # Vite bundler config
│   ├── electron.vite.config.ts # Electron-specific Vite config
│   ├── electron-builder.json  # Build configuration
│   ├── .gitignore
│   ├── src/
│   │   ├── main/             # Electron main process
│   │   │   ├── index.ts      # Main entry point
│   │   │   └── preload.ts    # Preload script
│   │   ├── renderer/         # React app (renderer process)
│   │   │   ├── index.html
│   │   │   ├── main.tsx      # React entry point
│   │   │   ├── App.tsx       # Main App component
│   │   │   ├── Router.tsx    # Route configuration
│   │   │   ├── styles/
│   │   │   │   └── global.css
│   │   │   ├── components/
│   │   │   │   ├── Layout/
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   └── Layout.tsx
│   │   │   │   ├── Toast/
│   │   │   │   │   └── Toast.tsx
│   │   │   │   └── common/
│   │   │   │       └── Button.tsx
│   │   │   ├── pages/
│   │   │   │   ├── HomePage.tsx
│   │   │   │   ├── ProjectPage.tsx
│   │   │   │   ├── ProductNew.tsx
│   │   │   │   └── SettingsPage.tsx
│   │   │   ├── contexts/
│   │   │   │   ├── ProjectContext.tsx
│   │   │   │   └── ToastContext.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useProjects.ts
│   │   │   │   └── useToast.ts
│   │   │   ├── services/
│   │   │   │   └── api.ts      # Mock API service
│   │   │   └── types/
│   │   │       └── index.ts     # TypeScript types
│   │   └── shared/              # Shared between main/renderer
│   │       └── types.ts
│   ├── public/                  # Static assets
│   │   └── icons/
│   └── dist/                    # Build output
```

### Known Gotchas & Library Specifics
```typescript
// CRITICAL: Electron security - always use contextBridge
// In preload.ts:
contextBridge.exposeInMainWorld('electronAPI', {
  // Only expose what's needed
})

// GOTCHA: Vite + Electron requires special config
// Need separate configs for main and renderer processes

// PATTERN: React 19.1 concurrent features
// Use startTransition for non-urgent updates

// CRITICAL: TypeScript strict mode
// tsconfig.json must have "strict": true

// GOTCHA: React Router v6 syntax changes
// Use <Routes> and element={<Component />} not component={Component}

// PATTERN: Mock API calls should simulate network delay
// Add 500-1000ms delay to mock responses
```

## Implementation Blueprint

### Data Models and Types
```typescript
// src/renderer/types/index.ts
export interface Project {
  id: string;
  name: string;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId: string;
  location: string;
  image: string;
  images: string[];
  description: string;
  specificationDescription: string;
  category: string;
  createdAt: Date;
}

export interface ApiError {
  message: string;
  code: string;
}

// Mock API response types
export interface FetchProductDetailsRequest {
  product_url: string;
  tag_id: string;
  product_location: string;
}

export interface FetchProductDetailsResponse {
  product_image: string;
  product_images: string[];
  product_description: string;
  specification_description: string;
  category: string;
}
```

### List of Tasks (In Order)
```yaml
Task 1: Initialize Electron project structure
  - CREATE electron-app directory
  - INIT npm project with package.json
  - INSTALL core dependencies:
    - electron@latest
    - react@19.1.0
    - react-dom@19.1.0
    - react-router-dom@6
    - typescript@5
    - vite@5
    - @vitejs/plugin-react
    - electron-builder
  - CREATE tsconfig.json with strict mode
  - CREATE vite configs for main and renderer

Task 2: Set up Electron main process
  - CREATE src/main/index.ts
    - PATTERN: BrowserWindow with security settings
    - IMPLEMENT: Window state management
    - SETUP: Development vs production paths
  - CREATE src/main/preload.ts
    - EXPOSE: Limited API via contextBridge
    - NO direct node.js access in renderer

Task 3: Create React app structure
  - CREATE src/renderer/index.html
  - CREATE src/renderer/main.tsx (React entry)
  - CREATE src/renderer/App.tsx
  - CREATE src/renderer/Router.tsx
    - ROUTES: /, /projects, /products/new, /settings
  - CREATE styles/global.css
    - STYLE: Match existing Flask UI aesthetic

Task 4: Implement Layout components
  - CREATE components/Layout/Layout.tsx
    - PATTERN: Persistent sidebar + main content area
  - CREATE components/Layout/Sidebar.tsx
    - ICONS: Projects, Settings
    - ACTIVE state highlighting
    - React Router NavLink usage

Task 5: Create Context providers
  - CREATE contexts/ProjectContext.tsx
    - STATE: Current project, all projects
    - ACTIONS: Create, update, select project
    - PERSIST: Local storage for project data
  - CREATE contexts/ToastContext.tsx
    - QUEUE: Multiple toast messages
    - AUTO-DISMISS: After 5 seconds
    - TYPES: Error, success, info

Task 6: Build HomePage component
  - CREATE pages/HomePage.tsx
    - SHOW: Project dropdown selector
    - CONDITIONAL: Show "Create first project" if none
    - BUTTON: "Add a product" (only when project selected)
    - NAVIGATE: To ProductNew on button click

Task 7: Implement ProjectPage
  - CREATE pages/ProjectPage.tsx
    - LIST: All projects in table format
    - SHOW: Project name, product count
    - INLINE EDIT: Click to edit project name
    - SAVE: On blur or Enter key
    - BACK: Button to return home

Task 8: Build ProductNew page
  - CREATE pages/ProductNew.tsx
    - FORM FIELDS: product_url, tag_id, product_location
    - BUTTON: "Fetch product details"
    - LOADING: State during API call
    - AUTOFILL: Populate fields from API response
    - EDITABLE: All fields remain editable
    - PREVIEW: Show product image
    - SAVE: "Add Product" button

Task 9: Create API service layer
  - CREATE services/api.ts
    - MOCK: fetchProductDetails function
    - DELAY: setTimeout 800ms
    - RETURN: Fake product data
    - ERROR: Random 10% failure rate
    - PATTERN: try/catch with typed errors

Task 10: Implement Toast notifications
  - CREATE components/Toast/Toast.tsx
    - POSITION: Top-right corner
    - ANIMATION: Slide in/out
    - STACK: Multiple toasts
    - CLOSE: X button or auto-dismiss
  - INTEGRATE: Show on API errors

Task 11: Add Settings page
  - CREATE pages/SettingsPage.tsx
    - PLACEHOLDER: "Settings coming soon"
    - STRUCTURE: For future preferences

Task 12: Configure build system
  - CREATE electron-builder.json
    - MAC: DMG output
    - WINDOWS: NSIS installer
    - ICONS: Include app icons
  - UPDATE package.json scripts:
    - "dev": Development with hot reload
    - "build": Production build
    - "dist": Create distributables

Task 13: Add development tooling
  - CONFIGURE: React DevTools in development
  - SETUP: Hot module replacement
  - ADD: TypeScript path aliases
  - IMPLEMENT: Environment variables
```

### Component Patterns
```typescript
// Pattern: Page component with hooks
export const HomePage: React.FC = () => {
  const { currentProject, projects } = useProjects();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleAddProduct = () => {
    if (!currentProject) {
      showToast('Please select a project first', 'error');
      return;
    }
    navigate('/products/new');
  };

  return (
    <div className="page-container">
      {/* Component content */}
    </div>
  );
};

// Pattern: Context with reducer
const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  
  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('projects');
    if (saved) {
      dispatch({ type: 'LOAD_PROJECTS', payload: JSON.parse(saved) });
    }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem('projects', JSON.stringify(state.projects));
  }, [state.projects]);

  return (
    <ProjectContext.Provider value={{ ...state, dispatch }}>
      {children}
    </ProjectContext.Provider>
  );
};

// Pattern: Mock API with error handling
export const fetchProductDetails = async (
  request: FetchProductDetailsRequest
): Promise<FetchProductDetailsResponse> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Random failure for testing
  if (Math.random() < 0.1) {
    throw new Error('API Error: Failed to fetch product details');
  }
  
  // Return mock data
  return {
    product_image: `https://picsum.photos/400/300?random=${Date.now()}`,
    product_images: [
      `https://picsum.photos/400/300?random=${Date.now()}`,
      `https://picsum.photos/400/300?random=${Date.now() + 1}`,
    ],
    product_description: 'High-quality architectural product suitable for modern buildings',
    specification_description: 'Dimensions: 24" x 36" x 2". Material: Stainless steel with powder coating.',
    category: 'Building Materials',
  };
};
```

## Validation Loop

### Level 1: TypeScript & Linting
```bash
cd electron-app

# TypeScript compilation
npx tsc --noEmit

# ESLint with React rules
npx eslint . --ext .ts,.tsx --fix

# Expected: No errors. Fix any type or lint errors.
```

### Level 2: Unit Tests
```bash
# Install test dependencies
npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom

# Create test files
# src/renderer/hooks/__tests__/useProjects.test.ts
# src/renderer/components/__tests__/Toast.test.tsx

# Run tests
npm run test

# Test coverage
npm run test:coverage
```

### Level 3: Development Build
```bash
# Start development server
npm run dev

# Tests:
# 1. App launches without errors
# 2. Hot reload works when editing components
# 3. All routes are accessible
# 4. Project creation and selection works
# 5. Mock API calls succeed/fail appropriately
# 6. Toast notifications appear on errors
```

### Level 4: Production Build
```bash
# Build for production
npm run build

# Create distributables
npm run dist

# Verify:
# - dist/mac/AppName.dmg exists (on Mac)
# - dist/win/AppName-setup.exe exists (on Windows)
# - Installers work correctly
# - Installed app launches and functions
```

## Validation Checklist
- [ ] TypeScript compiles without errors
- [ ] All routes navigate correctly
- [ ] Projects persist across app restarts
- [ ] Mock API integration works
- [ ] Error toasts display properly
- [ ] Sidebar navigation highlights active route
- [ ] Form validation prevents empty submissions
- [ ] Build creates platform-specific installers
- [ ] Hot reload works in development
- [ ] No console errors in production build

---

## Anti-Patterns to Avoid
- ❌ Don't expose Node.js APIs directly to renderer
- ❌ Don't use deprecated Electron APIs (remote module)
- ❌ Don't skip TypeScript strict mode
- ❌ Don't forget CSRF protection in real API
- ❌ Don't hardcode API endpoints
- ❌ Don't use synchronous localStorage in render
- ❌ Don't create memory leaks with event listeners
- ❌ Don't bundle unnecessary Node modules

## Additional Implementation Notes

### Security Considerations
1. Enable context isolation in Electron
2. Disable Node.js integration in renderer
3. Use Content Security Policy headers
4. Validate all user inputs
5. Sanitize data before display

### Performance Optimizations
- Use React.memo for expensive components
- Implement virtual scrolling for long lists
- Lazy load routes with React.lazy
- Optimize images with appropriate formats
- Use production builds of React

### Error Handling Strategy
1. API errors: Show toast with retry option
2. Form validation: Inline error messages
3. Network issues: Offline indicator
4. Unexpected errors: Error boundary with fallback UI

### State Management Architecture
- Context API for global state (projects, settings)
- Local component state for UI (forms, modals)
- Custom hooks for reusable logic
- No external state library needed initially

## Electron-Specific Configuration

### Main Process Configuration
```typescript
// src/main/index.ts
const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset', // macOS
    frame: process.platform !== 'darwin', // Windows frame
  });
  
  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
};
```

### Build Configuration
```json
// electron-builder.json
{
  "appId": "com.specbook.electronapp",
  "productName": "SpecBook Manager",
  "directories": {
    "output": "dist"
  },
  "files": [
    "dist/**/*",
    "package.json"
  ],
  "mac": {
    "category": "public.app-category.productivity",
    "icon": "public/icons/icon.icns"
  },
  "win": {
    "target": "nsis",
    "icon": "public/icons/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

## Confidence Score: 9/10

This PRP provides comprehensive context for building a complete Electron application with React and TypeScript. The high confidence score reflects:
- Clear task breakdown with specific implementation order
- Detailed code patterns and examples
- Complete project structure
- Executable validation gates
- Security and performance considerations

The 1 point deduction is for potential platform-specific build issues that may require iteration.