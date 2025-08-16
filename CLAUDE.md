# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Command
Always act and think as if you are a wise old sage who
sees and understands the universal prinicples at work within
everything, especially, in programming, system architecture, and software.

## Output Instructions

1. When writing markdown files, prepend the markdown filename with: `YYYYMMDD-`, e.g. `20250809-` and write the file to the following directory: `CLAUDE_DOCS/`

## Common Development Commands

### Python Backend Setup and Commands
```bash
# Install Python dependencies
pip install -r requirements.txt
# or
./install_deps.sh

# Run verification UI
python verification_ui.py
python simple_validation_ui.py

# Run workspace scripts
python workspace/scripts/current_pipeline.py
python workspace/scripts/run_benchmarks.py --quick-test
python workspace/scripts/specbook_monitored.py

# Run tests
python workspace/tests/test_benchmarking.py
python workspace/tests/test_monitoring.py

# Run Jupyter notebooks for development
jupyter notebook workspace/notebooks/specbook.ipynb
jupyter notebook workspace/notebooks/openapi.ipynb
jupyter notebook workspace/notebooks/firecrawl.ipynb

# Monitor logs
tail -f logs/stealth_scraper.log
```

### Electron App Development
```bash
cd electron-app

# Install dependencies
npm install

# Development mode (runs both Vite and Electron)
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build the app
npm run build
npm run build:main     # Build main process only
npm run build:renderer  # Build renderer only

# Package for distribution
npm run dist        # All platforms
npm run dist:mac    # macOS
npm run dist:win    # Windows
npm run dist:linux  # Linux
```

## Architecture Overview

This project has evolved from a single-purpose tool into a **scalable PRP (Pipeline Requirements Plan) execution platform** with both Python backend services and an Electron desktop application.

### High-Level Architecture

```
theranchmine-phase1-specbook/
├── 📚 lib/                      # Core Python library (refactored from tools/)
│   ├── core/                    # Scraping, LLM, HTML processing, evaluation
│   ├── monitoring/              # Pipeline monitoring & metrics
│   ├── benchmarking/            # Model comparison & caching
│   └── utils/                   # Rate limiting & utilities
│
├── 🖥️ electron-app/             # Desktop application
│   ├── src/main/               # Electron main process
│   ├── src/renderer/           # React application
│   └── src/shared/             # Shared types
│
├── 🚧 workspace/                # Active development area
│   ├── input/                  # Input data (specbook.csv)
│   ├── scripts/                # Current pipeline scripts
│   ├── notebooks/              # Jupyter notebooks
│   └── output/                 # Pipeline outputs
│
├── 🔗 shared/                   # Shared resources
│   ├── cache/                  # Persistent HTML/data cache
│   ├── config/                 # Global configuration
│   └── data/                   # Reference data
│
├── 📜 agent/                    # LLM agent framework
│   ├── therma.py              # Basic agent
│   └── therma_pydantic.py    # Pydantic-based agent
│
└── 🔄 executions/              # Historical execution tracking
    └── YYYY-MM-DD_*/           # Timestamped results
```

### Data Pipeline Flow

1. **Input**: Product URLs from `workspace/input/specbook.csv`
2. **Scraping**: Multi-tier fallback strategy via `lib.core.scraping.StealthScraper`
   - Primary: requests with anti-bot measures
   - Secondary: Selenium with undetected-chromedriver
   - Fallback: Firecrawl API
3. **Processing**: HTML cleaning via `lib.core.html_processor.HTMLProcessor`
4. **Extraction**: LLM-powered extraction via `lib.core.llm.LLMInvocator`
5. **Validation**: Manual verification through Flask UI (`verification_ui.py`)
6. **Monitoring**: Real-time metrics via `lib.monitoring.PipelineMonitor`
7. **Output**: Structured CSV with validation status

### Key Components

**Core Library (`lib/`)**
```python
from lib.core import StealthScraper, HTMLProcessor, LLMInvocator, PromptTemplator
from lib.core import ProductExtractionEvaluator, ScrapeResult, ProcessedHTML
from lib.monitoring import PipelineMonitor, MetricsCollector, ErrorAnalyzer
from lib.benchmarking import ExperimentRunner, CacheManager, ReportGenerator
```

**Electron App Architecture**
- **Main Process**: Window management, security, IPC (`src/main/`)
- **Renderer Process**: React 19.1 app with TypeScript (`src/renderer/`)
- **State Management**: React Context API (`ProjectContext`, `ToastContext`)
- **Routing**: React Router v6 for navigation
- **API Service**: Mock API ready for backend integration (`services/api.ts`)

**Agent Framework (`agent/therma_pydantic.py`)**
- Conversation management with role-based messaging
- Tool integration with parameter validation
- Type-safe tool calling and persistence

### Data Models and Validation

All data structures use Pydantic for type safety:
- `ScrapeResult`: Raw scraping results with metadata
- `ProcessedHTML`: Cleaned HTML with structured content
- `ProductExtractionResult`: LLM extraction output
- `Agent`/`Tool`/`Message`: Conversation management
- Product JSON schema: `{image_url, type, description, model_no, product_link, qty, key}`

### Environment Requirements

**Required Environment Variables:**
- `OPENAI_API_KEY`: OpenAI API access
- `FIRECRAWL_API_KEY`: Firecrawl fallback scraping (optional)

**System Dependencies:**
- Python 3.8+
- Node.js 18+ (for Electron app)
- Chrome/Chromium (for Selenium scraping)

## Development Workflow

### Pipeline Development Workflow
1. Create test dataset in `workspace/input/specbook.csv`
2. Develop/test in `workspace/notebooks/specbook.ipynb`
3. Run pipeline with monitoring: `python workspace/scripts/specbook_monitored.py`
4. Validate results: `python verification_ui.py`
5. Check metrics: `workspace/output/metrics/`

### Benchmarking Workflow
```bash
# Quick test with 5 URLs
python workspace/scripts/run_benchmarks.py --quick-test

# Compare multiple models
python workspace/scripts/run_benchmarks.py \
  --models gpt-4o-mini,gpt-4o,gpt-3.5-turbo \
  --limit 25

# View results in workspace/output/benchmarks/
```

### Electron App Development
1. Start backend services (if needed)
2. Run `npm run dev` in electron-app/
3. Make changes - hot reload enabled
4. Test packaging with `npm run dist`

## Code Patterns

### Import Pattern for Library
```python
# Clean API imports
from lib.core import StealthScraper, LLMInvocator
from lib.monitoring import PipelineMonitor
from lib.benchmarking import ExperimentRunner

# Initialize with monitoring
monitor = PipelineMonitor()
scraper = StealthScraper()
results = scraper.scrape_url(url)
monitor.record_metric("scrape", results)
```

### Error Handling Strategy
- Multi-method fallback (requests → Selenium → Firecrawl)
- Comprehensive error categorization and logging
- Graceful degradation with partial results
- Structured error reporting via Pydantic models

### Caching Architecture
- 3-layer cache: memory → file → SQLite database
- Automatic cache population from existing data
- Thread-safe operations
- 95%+ cache efficiency for repeated URLs

### Type Safety Best Practices
- Pydantic models for all data structures
- TypeScript for Electron app
- Typed tool interfaces in agent framework
- Comprehensive validation at boundaries

## React Best Practices

### Core Principles
- **Use Hooks at the top level** - Never call hooks inside loops, conditions, or nested functions
- **Enable Strict Mode** and use ESLint's React plugin to catch violations of React's rules
- **Separate concerns** - Use multiple `useEffect` hooks for different synchronization processes rather than combining unrelated logic

### Performance Optimization
- **Memoization**: Use `useMemo` for expensive calculations and `useCallback` for stable function references
- **Pass individual props** to memoized components instead of objects when possible
- **Use React.memo** to prevent unnecessary re-renders of components with stable props
- **Declare lazy components** at module top-level, never inside other components

### State Management
- **Calculate derived state during rendering** instead of using effects
- **Structure state well** - Avoid redundant state and calculate values on-the-fly
- **Use Context wisely** - Memoize context values with `useMemo`/`useCallback` to prevent re-renders
- **Prefer immutable updates** - Never mutate arrays/objects directly; use spread operators, `filter()`, `map()`

### Component Architecture
- **Never define components inside other components** - Causes performance issues and state loss
- **Extract reusable logic into custom hooks** but avoid mimicking lifecycle methods
- **Use Fragments** (`<>...</>`) to return multiple elements without wrapper DOM nodes
- **Assign unique, stable keys** to list items using data IDs, not array indices

### React Compiler & Modern Features
- **Use directives sparingly** - Prefer project-level compiler configuration
- **Document "use no memo"** directives with clear explanations and TODOs for removal
- **Place directives first** in function bodies before any other code
- **Protect flow state** - Respect deep work periods when implementing tooling

### Code Quality
- **Don't suppress linter warnings** especially for `react-hooks/exhaustive-deps`
- **Access refs only in effects or event handlers**, never during render
- **Use TypeScript** with proper typing for hooks, reducers, and components
- **Handle loading and error states** explicitly in data fetching scenarios

### Form & Event Handling
- **Wrap event handlers with useCallback** when passing to memoized child components
- **Use Server Actions** with `useFormStatus` for better form submission UX
- **Prevent secrets from reaching client** using taint APIs in server components

### Testing & Development
- **Follow your own instructions** when writing documentation
- **Use proper error boundaries** to catch and handle component errors gracefully
- **Implement proper cleanup** in useEffect return functions
- **Test with React DevTools** Profiler to identify performance bottlenecks

## Table UI Design Patterns

### Design Principles for Data Tables

#### Core Principles
- **Prioritize Readability**: Tables should be free from clutter, focusing on data comprehension
- **Strategic Color Usage**: Use colors only for specific purposes (status, highlighting, headers)
- **Zebra Striping**: Implement alternating row colors using light shades only
- **Typography Standards**: Use monospace fonts for numerical data, proper spacing for readability

#### Row Height Standards
- **Condensed**: 40px (high-density data, >100 items)
- **Regular**: 48px (standard use, 50-100 items)  
- **Relaxed**: 56px (comfortable reading, <50 items)

### React Table Implementation Patterns

#### Performance-Optimized Table Hook
```tsx
const useSortableTable = <T,>(data: T[], defaultSort?: SortConfig) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(defaultSort || null);
  
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);
  
  const handleSort = useCallback((key: keyof T) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);
  
  return { sortedData, sortConfig, handleSort };
};
```

#### Multi-Value Cell Components
```tsx
// For Product arrays (location[], category[], images[])
const MultiValueCell: React.FC<{ values: string[], max?: number }> = ({ 
  values, 
  max = 3 
}) => {
  const displayValues = values?.slice(0, max) || [];
  const remainingCount = Math.max(0, (values?.length || 0) - max);
  
  return (
    <div className="flex gap-1 flex-wrap">
      {displayValues.map((value, index) => (
        <span key={index} className="px-2 py-1 bg-slate-100 rounded text-xs">
          {value}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="px-2 py-1 bg-slate-200 rounded text-xs">
          +{remainingCount}
        </span>
      )}
    </div>
  );
};

// For Product image galleries
const ImageGalleryCell: React.FC<{ images: string[], primary?: string }> = ({
  images,
  primary
}) => {
  const [showGallery, setShowGallery] = useState(false);
  
  return (
    <div className="relative">
      <img 
        src={primary || images[0]} 
        alt="Product"
        className="w-12 h-12 object-cover rounded cursor-pointer"
        onClick={() => setShowGallery(true)}
      />
      {images.length > 1 && (
        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {images.length}
        </span>
      )}
      {/* Gallery modal implementation */}
    </div>
  );
};
```

#### Editable Table Cells
```tsx
const EditableCell: React.FC<EditableCellProps> = ({ 
  value, 
  onChange, 
  onSave,
  type = 'text' 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  
  const handleSave = useCallback(() => {
    onChange(editValue);
    onSave?.(editValue);
    setIsEditing(false);
  }, [editValue, onChange, onSave]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  }, [value, handleSave]);
  
  if (isEditing) {
    return (
      <input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-full border-0 outline-none bg-transparent"
      />
    );
  }
  
  return (
    <span 
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-blue-50 px-1 rounded"
    >
      {value}
    </span>
  );
};
```

#### Virtual Scrolling for Large Datasets
```tsx
const VirtualizedTable: React.FC<VirtualTableProps> = ({ 
  data, 
  rowHeight = 48,
  containerHeight = 400 
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(containerHeight / rowHeight);
    const end = Math.min(start + visibleCount + 1, data.length);
    return { start, end };
  }, [scrollTop, rowHeight, containerHeight, data.length]);
  
  const visibleData = useMemo(() => 
    data.slice(visibleRange.start, visibleRange.end),
    [data, visibleRange]
  );
  
  return (
    <div 
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: data.length * rowHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${visibleRange.start * rowHeight}px)` }}>
          {visibleData.map((row, index) => (
            <TableRow 
              key={visibleRange.start + index} 
              data={row} 
              style={{ height: rowHeight }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

#### Pagination Hook
```tsx
const usePagination = <T,>(data: T[], itemsPerPage: number = 25) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [data, currentPage, itemsPerPage]);
  
  const totalPages = Math.ceil(data.length / itemsPerPage);
  
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);
  
  return {
    currentPage,
    totalPages,
    paginatedData,
    goToPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };
};
```

### Project-Specific Table Integration

#### Product Table Component Structure
```
electron-app/src/renderer/components/ProductTable/
├── ProductTable.tsx              # Main table component
├── ProductTableRow.tsx           # Individual row component  
├── ProductTableCell.tsx          # Cell component
├── hooks/
│   ├── useProductTableState.ts   # Product-specific table logic
│   ├── useTableKeyboard.ts       # Keyboard navigation
│   └── useTableExport.ts         # Electron export integration
├── cells/
│   ├── MultiValueCell.tsx        # For location[], category[]
│   ├── ImageGalleryCell.tsx      # For product images
│   ├── PriceCell.tsx            # For formatted pricing
│   └── ActionsCell.tsx          # For row actions
├── filters/
│   ├── TableFilters.tsx         # Filter controls
│   └── ColumnPicker.tsx         # Column visibility
├── types.ts                     # TypeScript interfaces
└── index.ts                     # Public exports
```

#### Empty State Handling
```tsx
const EmptyStateCell: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <td className="text-slate-400 italic text-center">
    {children || '—'}
  </td>
);

// Usage pattern for missing data
const renderCell = (value: any) => {
  if (value === null || value === undefined || value === '') {
    return <EmptyStateCell>No data</EmptyStateCell>;
  }
  return <td>{value}</td>;
};
```

#### Electron Desktop Integration
```tsx
const useDesktopTableFeatures = () => {
  const handleExport = useCallback(async (data: Product[]) => {
    const { ipcRenderer } = window.electron;
    await ipcRenderer.invoke('export-products', data);
  }, []);
  
  const handleKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'a': // Select all
        case 'e': // Export  
        case 'f': // Filter
          e.preventDefault();
          // Handle shortcuts
      }
    }
  }, []);
  
  return { handleExport, handleKeyboardShortcuts };
};
```

### CSS Architecture for Tables
```css
.table-container {
  --table-border: var(--border-color);
  --table-row-hover: var(--bg-secondary);
  --table-header-bg: var(--bg-secondary);
  --table-zebra-even: var(--bg-primary);
  --table-zebra-odd: #fafafa;
}

.product-table {
  border: 1px solid var(--table-border);
  border-radius: 0.375rem;
  font-family: inherit;
}

.table-row:hover {
  background-color: var(--table-row-hover);
}

.table-header {
  background-color: var(--table-header-bg);
  position: sticky;
  top: 0;
  z-index: 10;
}
```