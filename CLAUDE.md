# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- Comprehensive validation at boundaries