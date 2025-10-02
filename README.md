# Specbook Manager

> AI-powered product specification extraction and management platform

Specbook Manager is a desktop application that automates the extraction, validation, and organization of product specifications from vendor websites. It combines intelligent web scraping, LLM-powered data extraction, and a modern desktop interface to streamline specification book creation.

## 🌟 Key Features

### Intelligent Product Data Extraction
- **Multi-Tier Scraping**: Automatic fallback strategy (requests → Selenium → Firecrawl API) ensures reliable data extraction
- **LLM-Powered Processing**: OpenAI models extract structured product information from raw HTML
- **Smart Caching**: 95%+ cache efficiency with 3-layer caching system (memory → file → database)

### Visual Validation & Management
- **Interactive Verification UI**: Review and validate extracted product data
- **Asset Management**: Content-addressable storage with automatic thumbnail generation
- **Project Organization**: SQLite-backed project files with full CRUD operations

### Performance & Monitoring
- **Real-Time Metrics**: Track scraping success rates, processing times, and error patterns
- **Model Benchmarking**: Compare LLM model performance across accuracy, speed, and cost
- **Comprehensive Logging**: Detailed operation logs for debugging and analysis

### Cross-Platform Desktop App
- **Modern Interface**: React 19.1 with TypeScript for type-safe, responsive UI
- **Native Integration**: Electron-based desktop app for Windows, macOS, and Linux
- **PDF Export**: Generate professional specification documents

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** (for backend scraping engine)
- **Node.js 18+** (for desktop application)
- **Chrome/Chromium** (for Selenium-based scraping)
- **OpenAI API Key** (required)
- **Firecrawl API Key** (optional fallback)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd theranchmine-phase1-specbook

# Install Python dependencies
cd specscraper
pip install -r requirements.txt

# Install Node.js dependencies
cd ../electron-app
npm install
```

### Configuration

Create a `.env` file in the `specscraper` directory:

```bash
OPENAI_API_KEY=your_openai_key_here
FIRECRAWL_API_KEY=your_firecrawl_key_here  # Optional
```

### Running the Application

**Desktop App (Development)**
```bash
cd electron-app
npm run dev          # Full development mode
npm run dev:fast     # Skip Python bundling for faster restarts
```

**Python Backend Only**
```bash
cd specscraper
python verification_ui.py  # Launch validation interface
```

## 📋 Usage

### Basic Workflow

1. **Prepare Input Data**
   - Create CSV with product URLs in `specscraper/workspace/input/specbook.csv`
   - Required columns: product URL, quantity, key identifiers

2. **Run Extraction Pipeline**
   ```bash
   cd specscraper
   python workspace/scripts/specbook_monitored.py
   ```

3. **Validate Results**
   ```bash
   python verification_ui.py
   ```
   - Opens Flask UI at `http://localhost:5000`
   - Review extracted data and mark as validated

4. **Monitor Performance**
   - Check metrics in `specscraper/workspace/output/metrics/`
   - Review logs in `specscraper/logs/`

### Model Benchmarking

Compare different LLM models for your specific use case:

```bash
cd specscraper

# Quick test with 5 URLs
python workspace/scripts/run_benchmarks.py --quick-test

# Compare multiple models
python workspace/scripts/run_benchmarks.py \
  --models gpt-4o-mini,gpt-4o,gpt-3.5-turbo \
  --limit 25
```

Results are saved to `specscraper/workspace/output/benchmarks/`

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Desktop Application                     │
│              (Electron + React + TypeScript)             │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
              │ IPC Communication         │
              │                           │
┌─────────────▼───────────────┐  ┌───────▼──────────────┐
│   Python Scraping Engine    │  │  SQLite Database     │
│  • Web Scraping             │  │  • Projects          │
│  • HTML Processing          │  │  • Products          │
│  • LLM Extraction           │  │  • Assets            │
└─────────────────────────────┘  └──────────────────────┘
```

### Data Pipeline

1. **Scraping**: Multi-tier fallback strategy fetches product pages
2. **Processing**: HTML cleaning and content extraction
3. **Extraction**: LLM converts HTML to structured JSON
4. **Validation**: Human-in-the-loop verification via UI
5. **Storage**: Validated data persists to SQLite database
6. **Export**: Generate PDFs or export to CSV

### Project Structure

```
theranchmine-phase1-specbook/
├── specscraper/              # Python backend
│   ├── lib/                  # Core library
│   │   ├── core/            # Scraping, LLM, processing
│   │   ├── monitoring/      # Metrics and logging
│   │   ├── benchmarking/    # Model comparison
│   │   └── utils/           # Utilities
│   ├── workspace/           # Active development
│   │   ├── input/          # Input CSV files
│   │   ├── output/         # Results and metrics
│   │   ├── scripts/        # Pipeline scripts
│   │   └── notebooks/      # Jupyter notebooks
│   └── shared/             # Shared resources
│       ├── cache/          # Persistent cache
│       └── config/         # Configuration
│
└── electron-app/            # Desktop application
    ├── src/main/           # Electron main process
    ├── src/renderer/       # React UI
    └── src/shared/         # Shared types
```

## 🛠️ Development

### Python Backend

```bash
cd specscraper

# Run tests
python -m pytest workspace/tests/ -v

# Development with Jupyter
jupyter notebook workspace/notebooks/specbook.ipynb

# Monitor logs
tail -f logs/stealth_scraper.log
```

### Electron App

```bash
cd electron-app

# Type checking
npm run type-check

# Run tests
npm test                # All tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage

# Build for production
npm run dist            # All platforms
npm run dist:mac        # macOS only
npm run dist:win        # Windows only
```

## 🔧 Key Technologies

### Backend
- **Python 3.8+**: Core scraping and processing engine
- **Pydantic**: Type-safe data models and validation
- **Selenium**: Advanced web scraping with undetected-chromedriver
- **OpenAI API**: LLM-powered data extraction
- **Flask**: Validation UI web server
- **pytest**: Testing framework

### Frontend
- **Electron**: Cross-platform desktop application framework
- **React 19.1**: Modern UI library with TypeScript
- **Vite**: Fast build tool and development server
- **React Router v6**: Navigation and routing
- **Jest**: Testing framework

### Data & Storage
- **SQLite**: Lightweight embedded database
- **Better-sqlite3**: Synchronous database operations
- **Sharp**: High-performance image processing
- **Content-addressable storage**: Efficient asset management

## 📊 Performance

- **Scraping Success Rate**: 95%+ with multi-tier fallback
- **Cache Hit Rate**: 95%+ for repeated URLs
- **Processing Speed**: ~2-5 seconds per product URL (cached)
- **LLM Extraction**: Configurable models from gpt-3.5-turbo to gpt-4o

## 🤝 Contributing

This is an active development project. Key areas for contribution:
- Additional scraping strategies for difficult websites
- LLM prompt optimization for specific product categories
- UI/UX improvements for the desktop application
- Test coverage expansion

## 📝 License

[License information to be added]

## 🆘 Support

For issues, questions, or contributions, please refer to the project's issue tracker or documentation.

---

**Built with** ❤️ **for efficient specification book management**