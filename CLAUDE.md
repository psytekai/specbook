# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Python Backend Setup and Commands
```bash
# Navigate to the Python backend
cd specscraper

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

# Test single components
python -m pytest workspace/tests/test_benchmarking.py::TestSpecificFunction
python -m pytest workspace/tests/ -v

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

# Development mode options
npm run dev          # Full dev mode with Python bundling
npm run dev:fast     # Skip Python bundling (faster restarts)
npm run dev:lite     # Minimal mode without Python resources

# Type checking
npm run type-check

# Linting
npm run lint

# Build the app
npm run build
npm run build:main     # Build main process only
npm run build:renderer  # Build renderer only

# Testing
npm test            # Run all tests
npm run test:watch  # Watch mode
npm run test:coverage # With coverage
npm run test:main   # Test main process only

# Package for distribution
npm run dist        # All platforms
npm run dist:mac    # macOS
npm run dist:win    # Windows
npm run dist:linux  # Linux

# Python integration
npm run bundle-python     # Bundle Python bridge for distribution
npm run copy-resources    # Copy Python resources to dist
npm run copy-win-bridge   # Prepare Windows Python bridge

# Native modules
npm run rebuild           # Rebuild native modules for Electron
npm run native:extract    # Extract native modules for distribution
npm run native:verify     # Verify native module extraction

# Utilities
npm run preview          # Preview built renderer
```

## Architecture Overview

This project has evolved from a single-purpose tool into a **scalable PRP (Pipeline Requirements Plan) execution platform** with both Python backend services and an Electron desktop application.

### High-Level Architecture

```
theranchmine-phase1-specbook/
├── 📁 specscraper/              # Python backend (main working directory)
│   ├── 📚 lib/                  # Core Python library (refactored from tools/)
│   │   ├── core/               # Scraping, LLM, HTML processing, evaluation
│   │   ├── monitoring/         # Pipeline monitoring & metrics
│   │   ├── benchmarking/       # Model comparison & caching
│   │   └── utils/              # Rate limiting & utilities
│   │
│   ├── 🚧 workspace/            # Active development area
│   │   ├── input/              # Input data (specbook.csv)
│   │   ├── scripts/            # Current pipeline scripts
│   │   ├── notebooks/          # Jupyter notebooks
│   │   └── tests/              # Test files
│   │
│   ├── 🔗 shared/               # Shared resources
│   │   ├── cache/              # Persistent HTML/data cache
│   │   ├── config/             # Global configuration
│   │   └── data/               # Reference data
│   │
│   ├── templates/               # HTML/UI templates
│   ├── examples/                # Example configurations
│   └── verification_ui.py       # Flask validation interface
│
├── 🖥️ electron-app/             # Desktop application
│   ├── src/main/               # Electron main process
│   ├── src/renderer/           # React application
│   └── src/shared/             # Shared types
│
└── 🔄 executions/              # Historical execution tracking
    └── YYYY-MM-DD_*/           # Timestamped results
```

### Data Pipeline Flow

1. **Input**: Product URLs from `specscraper/workspace/input/specbook.csv`
2. **Scraping**: Multi-tier fallback strategy via `specscraper/lib.core.scraping.StealthScraper`
   - Primary: requests with anti-bot measures
   - Secondary: Selenium with undetected-chromedriver
   - Fallback: Firecrawl API
3. **Processing**: HTML cleaning via `specscraper/lib.core.html_processor.HTMLProcessor`
4. **Extraction**: LLM-powered extraction via `specscraper/lib.core.llm.LLMInvocator`
5. **Validation**: Manual verification through Flask UI (`specscraper/verification_ui.py`)
6. **Monitoring**: Real-time metrics via `specscraper/lib.monitoring.PipelineMonitor`
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
- **Testing**: Jest with TypeScript support
- **Build System**: Vite for renderer, TypeScript for main process
- **Native Dependencies**: Better-sqlite3, Sharp, Puppeteer

### Data Models and Validation

All data structures use Pydantic for type safety:
- `ScrapeResult`: Raw scraping results with metadata
- `ProcessedHTML`: Cleaned HTML with structured content
- `ProductExtractionResult`: LLM extraction output
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
1. Create test dataset in `specscraper/workspace/input/specbook.csv`
2. Develop/test in `specscraper/workspace/notebooks/specbook.ipynb`
3. Run pipeline with monitoring from `specscraper/`: `python workspace/scripts/specbook_monitored.py`
4. Validate results from `specscraper/`: `python verification_ui.py`
5. Check metrics in `specscraper/workspace/output/metrics/`

### Benchmarking Workflow
```bash
# Quick test with 5 URLs
python workspace/scripts/run_benchmarks.py --quick-test

# Compare multiple models
python workspace/scripts/run_benchmarks.py \
  --models gpt-4o-mini,gpt-4o,gpt-3.5-turbo \
  --limit 25

# View results in specscraper/workspace/output/benchmarks/
```

### Electron App Development
1. Run `npm run dev` in `electron-app/` (or `dev:fast` for quicker restarts)
2. Make changes - hot reload enabled for renderer, restart for main process changes
3. Test Python bridge integration with `bundle-python` before distribution
4. Test packaging with `npm run dist` (use `dist:mac` or `dist:win` for specific platforms)

### Testing Workflow
```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Test specific file
npm test AssetManager.test.ts

# Main process tests only
npm run test:main

# Coverage report
npm run test:coverage
```

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
- Comprehensive validation at boundaries

### Electron App Architecture Patterns

**IPC Communication**
- Main process handles file system operations via `ProjectFileManager`
- Renderer communicates via `window.electronAPI` exposed through preload
- API endpoints mirror REST conventions: `apiGet`, `apiPost`, `apiPut`, `apiDelete`

**Asset Management**
- Content-addressable storage using SHA-256 hashes
- Automatic thumbnail generation via Sharp
- Assets stored in `.specbook/assets/` directory
- Database tracks reference counts for cleanup
- Services: `AssetManager` handles all image operations

**Project File Structure**
```
project-name.specbook/
├── manifest.json              # Project metadata
├── project.db                 # SQLite database
└── assets/
    ├── [hash].jpg           # Full-size images
    └── thumbnails/
        └── [hash].jpg       # Generated thumbnails
```

**State Management**
- `ProjectContext`: Active project state, products, tags
- `ToastContext`: Global notification system
- `ElectronProjectContext`: Bridge between Electron and React state
- State persists to SQLite via IPC handlers

**Key Services**
- `ProjectFileManager`: Project file operations and persistence
- `AssetManager`: Content-addressable image storage and thumbnails
- `PythonBridge`: Integration with Python scraping backend
- `productDataService`: Database operations for products
- `pdfExportService`: PDF generation for specifications

### Testing Strategy
- **Python Backend**: pytest for unit/integration tests
- **Electron App**: Jest with TypeScript support
- **End-to-End**: Manual validation UI for pipeline results
- **Coverage**: Available via `npm run test:coverage` for Electron
- Always remove legacy code, do not migrate. This is a net new project.