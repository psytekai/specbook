    # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Setup and Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Install dependencies with shell script
./install_deps.sh

# Run the verification UI
python verification_ui.py
```

### Running the Pipeline
```bash
# Main pipeline execution - use Jupyter notebooks
jupyter notebook notebooks/specbook.ipynb

# Test LLM integration
jupyter notebook notebooks/openapi.ipynb

# Test Firecrawl integration
jupyter notebook notebooks/firecrawl.ipynb
```

### Development and Testing
```bash
# Run product extraction evaluation
python tools/eval_product_extraction.py

# Check logs
tail -f logs/stealth_scraper.log
```

## Architecture Overview

### Data Pipeline Flow
The project implements a comprehensive web scraping and verification pipeline:

1. **Input**: Product URLs from `01_llmpipeline/specbook.csv`
2. **Scraping**: Multi-method scraping via `tools/stealth_scraper.py` (requests → Selenium → Firecrawl fallback)
3. **Processing**: HTML cleaning and structuring via `tools/html_processor.py`
4. **Extraction**: LLM-powered data extraction using `tools/llm_invocator.py` with prompts from `tools/prompt_templator.py`
5. **Validation**: Manual verification through Flask UI (`verification_ui.py`)
6. **Output**: Structured product data in CSV format

### Key Components

**Web Scraping (`tools/stealth_scraper.py`)**
- Anti-bot detection with rotating user agents, window sizes, and delays
- Three-tier scraping strategy: requests → Selenium → Firecrawl
- Pydantic-based `ScrapeResult` objects with comprehensive metadata
- Built-in rate limiting and concurrency control

**Data Processing (`tools/html_processor.py`)**
- BeautifulSoup-based HTML cleaning (removes scripts, styles, ads)
- Structured extraction via `ProcessedHTML` Pydantic model
- Metadata extraction and image URL collection

**LLM Integration (`tools/llm_invocator.py` + `tools/prompt_templator.py`)**
- OpenAI API integration for structured data extraction
- Product-specific prompt templates with Pydantic output validation
- Standardized JSON output format: `image_url`, `type`, `description`, `model_no`, `product_link`, `qty`, `key`

**Agent Framework (`agent/therma_pydantic.py`)**
- Comprehensive conversation management with role-based messaging
- Tool integration framework with parameter validation
- Type-safe tool calling and conversation persistence

**Verification Interface (`verification_ui.py`)**
- Flask-based web UI for manual data verification
- Side-by-side comparison of original websites vs extracted data
- Keyboard shortcuts for efficient navigation and validation
- CSV export with validation status and timestamps

### Data Models and Validation

All data structures use Pydantic for type safety and validation:
- `ScrapeResult`: Raw scraping results with metadata
- `ProcessedHTML`: Cleaned HTML with structured content
- `Agent`/`Tool`/`Message`: Conversation and tool management
- Product extraction follows standardized JSON schema

### Environment Requirements

**Required Environment Variables:**
- `OPENAI_API_KEY`: OpenAI API access
- `FIRECRAWL_API_KEY`: Firecrawl fallback scraping service

**Dependencies:**
- Chrome/Chromium browser for Selenium scraping
- Python 3.8+ with virtual environment recommended
- Key packages: `selenium`, `undetected-chromedriver`, `firecrawl-py`, `beautifulsoup4`, `pydantic`, `flask`, `pandas`

## Development Workflow

### Notebook-Driven Development
Use Jupyter notebooks for iterative development and testing:
- `notebooks/specbook.ipynb`: Main pipeline execution and testing
- `notebooks/firecrawl.ipynb`: Firecrawl integration testing
- `notebooks/openapi.ipynb`: LLM API testing and prompt development

### Data Pipeline Development
1. Start with small test datasets in `01_llmpipeline/specbook.csv`
2. Test scraping methods individually using the notebook
3. Validate HTML processing and prompt generation
4. Test LLM extraction with sample data
5. Use the verification UI to validate results

### Quality Assessment
Use `tools/eval_product_extraction.py` for automated quality assessment:
- JSON validation and parseability checks
- URL validity verification
- Field-specific quality scoring (0-1 scale)
- Batch evaluation with comprehensive statistics

### Debugging and Monitoring
- Check `logs/stealth_scraper.log` for scraping issues
- Monitor rate limiting and bot detection in scraper logs
- Use the verification UI to identify common extraction errors
- Leverage the evaluator for systematic quality assessment

## Code Patterns

### Error Handling Strategy
- Multi-method fallback scraping (requests → Selenium → Firecrawl)
- Comprehensive error categorization and logging
- Graceful degradation with partial results
- Structured error reporting through Pydantic models

### Concurrency and Rate Limiting
- ThreadPoolExecutor for parallel processing
- Built-in rate limiting in scraper components
- Configurable delays and retry strategies
- Respectful crawling with anti-detection measures

### Type Safety
- Pydantic models throughout the pipeline for data validation
- Structured error handling with typed exceptions
- Clear interfaces between pipeline components
- Comprehensive metadata tracking