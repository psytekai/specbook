name: "Specbook Pipeline Benchmarking and Monitoring System"
description: |

## Purpose
Implement a comprehensive benchmarking and monitoring system for the specbook pipeline to track performance, identify failures, compare LLM models/prompts, and ensure 100% success rates for scraping and extraction tasks.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Build a monitoring and benchmarking system that:
- Tracks all pipeline executions with detailed metrics
- Identifies and categorizes failures (HTTP errors, bot detection, rate limits, LLM errors)
- Enables comparison of different OpenAI models and prompts
- Implements smart caching to avoid re-scraping during prompt iteration
- Generates comprehensive reports with actionable insights
- Achieves 100% accuracy goals (except for legitimate 404s)

## Why
- **Business value**: Save 20+ hours per project on manual spec book creation
- **Quality assurance**: Ensure reliable data extraction for architectural specifications
- **Cost optimization**: Compare model performance vs cost to find optimal configuration
- **Developer efficiency**: Quick identification and resolution of pipeline issues
- **Continuous improvement**: Data-driven prompt and model selection

## What
User-visible features:
1. Real-time pipeline monitoring dashboard (console output)
2. Detailed error reports with categorization
3. Model/prompt comparison reports with quality scores
4. Cost tracking and optimization recommendations
5. HTML caching to enable rapid prompt iteration without re-scraping

### Success Criteria
- [ ] 100% product site fetch accuracy (404s properly documented)
- [ ] 100% LLM call success rate (no rate limit errors)
- [ ] 100% valid product image URL extraction
- [ ] Comprehensive logging of all failures with actionable error messages
- [ ] Benchmarking reports comparing at least 3 OpenAI models
- [ ] HTML caching reduces re-scraping by 95%+ during prompt iteration

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- url: https://platform.openai.com/docs/guides/rate-limits
  why: Understanding OpenAI rate limits and best practices
  
- url: https://platform.openai.com/docs/models
  why: Model capabilities, costs, and token limits for benchmarking
  
- file: tools/stealth_scraper.py
  why: ScrapeResult model, error categorization patterns, logging approach
  
- file: tools/eval_product_extraction.py
  why: Existing evaluation patterns, quality scoring logic
  
- file: tools/llm_invocator.py
  why: Rate limiter integration, error handling patterns

- file: scripts/specbook.py
  why: Current pipeline implementation, data flow understanding

- file: tools/prompt_templator.py
  why: ProductExtractionOutput model, prompt structure

- file: CLAUDE.md
  why: Project conventions, development commands, architecture overview

- doc: https://docs.python.org/3/library/sqlite3.html
  section: Using SQLite for simple metrics storage
  critical: Thread-safe usage for concurrent operations

- url: https://pandas.pydata.org/docs/user_guide/io.html#csv-text-files
  why: Efficient CSV handling for large result sets
```

### Current Codebase tree
```bash
phase1-specbook/
├── 01_llmpipeline/          # Data files
├── tools/                   # Core pipeline tools
│   ├── stealth_scraper.py   # Web scraping with fallbacks
│   ├── html_processor.py    # HTML cleaning
│   ├── prompt_templator.py  # LLM prompt generation
│   ├── llm_invocator.py     # LLM API calls
│   └── eval_product_extraction.py  # Quality evaluation
├── scripts/
│   └── specbook.py          # Main pipeline script
├── notebooks/               # Jupyter notebooks for testing
└── logs/                    # Log files
```

### Desired Codebase tree with new files
```bash
phase1-specbook/
├── tools/
│   ├── monitoring/
│   │   ├── __init__.py
│   │   ├── pipeline_monitor.py      # Real-time monitoring of pipeline execution
│   │   ├── metrics_collector.py     # Structured metrics collection
│   │   └── error_analyzer.py        # Error categorization and analysis
│   ├── benchmarking/
│   │   ├── __init__.py
│   │   ├── experiment_runner.py     # Manage model/prompt experiments
│   │   ├── cache_manager.py         # HTML caching to avoid re-scraping
│   │   └── report_generator.py      # Generate comparison reports
├── scripts/
│   ├── specbook_monitored.py        # Enhanced pipeline with monitoring
│   └── run_benchmarks.py            # Benchmarking execution script
├── data/
│   ├── cache/                       # Cached HTML content
│   ├── metrics/                     # Monitoring metrics storage
│   └── benchmarks/                  # Benchmark results
└── context/plans/
    └── task_25_07_07_benchmarking.md  # Implementation plans
```

### Known Gotchas & Library Quirks
```python
# CRITICAL: OpenAI rate limits vary by model
# gpt-4o-mini: 30,000 TPM, 500 RPM
# gpt-4o: 30,000 TPM, 500 RPM  
# gpt-3.5-turbo: 200,000 TPM, 3,000 RPM

# GOTCHA: Pandas SettingWithCopyWarning when modifying DataFrames
# Always use .loc[] for modifications, never chained assignment

# PATTERN: All tools use Pydantic models for data validation
# Follow existing patterns from ScrapeResult, ProcessedHTML

# CRITICAL: ThreadPoolExecutor in specbook.py uses max_workers=10
# Respect this limit to avoid overwhelming target servers

# GOTCHA: Firecrawl has its own rate limits and token consumption
# Must track Firecrawl usage separately from OpenAI
```

## Implementation Blueprint

### Data models and structure

```python
# monitoring/models.py - Core monitoring data structures
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Optional
from enum import Enum

class PipelineStage(str, Enum):
    SCRAPING = "scraping"
    HTML_PROCESSING = "html_processing"
    LLM_EXTRACTION = "llm_extraction"
    VALIDATION = "validation"

class MetricType(str, Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"

class PipelineMetric(BaseModel):
    """Single metric measurement"""
    name: str
    value: float
    type: MetricType
    labels: Dict[str, str] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.now)

class PipelineExecution(BaseModel):
    """Complete pipeline execution record"""
    execution_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    total_urls: int
    successful_scrapes: int = 0
    failed_scrapes: int = 0
    bot_detections: int = 0
    rate_limit_errors: int = 0
    llm_errors: int = 0
    total_cost: float = 0.0
    metrics: List[PipelineMetric] = Field(default_factory=list)

# benchmarking/models.py - Benchmarking data structures  
class ExperimentConfig(BaseModel):
    """Configuration for a benchmarking experiment"""
    experiment_id: str
    model_name: str
    temperature: float = 0.7
    max_tokens: int = 1000
    prompt_template: str
    prompt_version: str

class ExperimentResult(BaseModel):
    """Results from a single experiment run"""
    config: ExperimentConfig
    execution_time: float
    total_cost: float
    quality_scores: Dict[str, float]  # From eval_product_extraction
    success_rate: float
    error_counts: Dict[str, int]
```

### List of tasks to be completed in order

```yaml
Task 1: Create monitoring infrastructure
MKDIR tools/monitoring:
  - CREATE __init__.py (empty)
  - CREATE models.py with PipelineMetric, PipelineExecution models
  - CREATE pipeline_monitor.py with PipelineMonitor class
  - PATTERN: Follow ScrapeResult model structure from tools/stealth_scraper.py

Task 2: Integrate monitoring into existing pipeline
MODIFY scripts/specbook.py → CREATE scripts/specbook_monitored.py:
  - PRESERVE all existing logic
  - INJECT monitoring calls at key points:
    - Before/after scraping
    - Before/after LLM calls
    - On errors
  - ADD structured logging with metrics

Task 3: Create error analysis system
CREATE tools/monitoring/error_analyzer.py:
  - PATTERN: Use PageIssue enum pattern from stealth_scraper.py
  - CATEGORIZE errors: NetworkError, BotDetection, RateLimit, LLMError
  - GENERATE actionable error reports

Task 4: Implement caching system
MKDIR tools/benchmarking:
  - CREATE cache_manager.py
  - USE sqlite3 for cache metadata (URL → file mapping)
  - STORE HTML in data/cache/ directory
  - CHECK llm_results.csv first before scraping

Task 5: Create experiment runner
CREATE tools/benchmarking/experiment_runner.py:
  - LOAD cached HTML instead of re-scraping
  - RUN multiple models: gpt-4o-mini, gpt-4o, gpt-3.5-turbo
  - TRACK costs using token counts
  - INTEGRATE with eval_product_extraction.py

Task 6: Build report generator
CREATE tools/benchmarking/report_generator.py:
  - COMPARE model performance metrics
  - CALCULATE cost vs quality trade-offs
  - GENERATE markdown reports
  - INCLUDE charts using matplotlib

Task 7: Create execution scripts
CREATE scripts/run_benchmarks.py:
  - ORCHESTRATE full benchmark runs
  - PARAMETER: --use-cache to skip scraping
  - OUTPUT: Comprehensive comparison report

Task 8: Write implementation plans
CREATE context/plans/task_25_07_07_benchmarking.md:
  - DOCUMENT system design
  - EXPLAIN usage instructions
  - PROVIDE troubleshooting guide
```

### Per task pseudocode

```python
# Task 1: Pipeline Monitor
class PipelineMonitor:
    def __init__(self):
        self.current_execution = None
        self.metrics_store = []  # In-memory for now
        
    def start_execution(self, total_urls: int) -> str:
        # PATTERN: Generate execution_id like ScrapeResult
        execution_id = f"exec_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.current_execution = PipelineExecution(
            execution_id=execution_id,
            start_time=datetime.now(),
            total_urls=total_urls
        )
        return execution_id
    
    def record_scrape_result(self, result: ScrapeResult):
        # PATTERN: Check result.success and categorize errors
        if result.success:
            self.current_execution.successful_scrapes += 1
        else:
            self.current_execution.failed_scrapes += 1
            # GOTCHA: Check page_issues for bot detection
            if PageIssue.BOT_DETECTED in result.page_issues:
                self.current_execution.bot_detections += 1

# Task 4: Cache Manager  
class CacheManager:
    def __init__(self, cache_dir: str = "data/cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True, parents=True)
        # CRITICAL: Use sqlite for thread-safe cache tracking
        self.db_path = self.cache_dir / "cache.db"
        self._init_db()
        
    def get_cached_html(self, url: str) -> Optional[str]:
        # PATTERN: Check llm_results.csv first
        if self._check_llm_results(url):
            cache_key = hashlib.md5(url.encode()).hexdigest()
            cache_file = self.cache_dir / f"{cache_key}.html"
            if cache_file.exists():
                return cache_file.read_text()
        return None

# Task 5: Experiment Runner
class ExperimentRunner:
    def __init__(self, cache_manager: CacheManager):
        self.cache_manager = cache_manager
        self.llm_invocator = LLMInvocator()
        self.evaluator = ProductExtractionEvaluator()
        
    async def run_experiment(self, urls: List[str], config: ExperimentConfig):
        # CRITICAL: Use cached HTML to avoid re-scraping
        results = []
        for url in urls:
            html = self.cache_manager.get_cached_html(url)
            if not html:
                # GOTCHA: Only scrape if not cached
                html = await self._scrape_with_monitoring(url)
                
            # PATTERN: Reuse prompt generation from prompt_templator
            cleaned = html_processor.clean_html(html)
            prompt = prompt_templator.product_extraction(url, cleaned.model_dump_json())
            
            # CRITICAL: Track token usage for cost calculation
            response = await self._llm_call_with_tracking(prompt, config)
            
            # PATTERN: Use existing evaluator
            eval_result = self.evaluator.evaluate_extraction(response, url)
            results.append(eval_result)
```

### Integration Points
```yaml
MONITORING:
  - inject into: scripts/specbook.py → specbook_monitored.py
  - pattern: "monitor.record_scrape_result(scrape_result)"
  - timing: After each scraping attempt, LLM call
  
CACHING:
  - check first: 01_llmpipeline/llm_results.csv
  - store in: data/cache/{url_hash}.html
  - metadata: SQLite DB with url, hash, timestamp, size
  
LOGGING:
  - enhance: Existing loggers in tools/
  - format: Structured JSON logs for metrics parsing
  - level: INFO for metrics, ERROR for failures

CONFIGURATION:
  - add to: New config/benchmarking.yaml
  - pattern: 
    models:
      - name: gpt-4o-mini
        temperature: 0.7
        max_tokens: 1000
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
ruff check tools/monitoring/ tools/benchmarking/ scripts/ --fix
mypy tools/monitoring/ tools/benchmarking/ scripts/

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests
```python
# CREATE tests/test_monitoring.py
import pytest
from tools.monitoring import PipelineMonitor, PipelineMetric

def test_pipeline_execution_tracking():
    """Monitor tracks execution metrics correctly"""
    monitor = PipelineMonitor()
    exec_id = monitor.start_execution(total_urls=10)
    
    # Simulate successful scrape
    mock_result = ScrapeResult(
        success=True,
        url="https://example.com",
        status_code=200,
        content="<html>...</html>",
        final_url="https://example.com",
        final_method=ScrapingMethod.REQUESTS
    )
    monitor.record_scrape_result(mock_result)
    
    assert monitor.current_execution.successful_scrapes == 1
    assert monitor.current_execution.failed_scrapes == 0

def test_cache_manager():
    """Cache manager stores and retrieves HTML"""
    cache = CacheManager("tests/test_cache")
    test_url = "https://example.com/product"
    test_html = "<html>Test content</html>"
    
    # Store
    cache.store_html(test_url, test_html)
    
    # Retrieve
    cached = cache.get_cached_html(test_url)
    assert cached == test_html

# CREATE tests/test_benchmarking.py
def test_experiment_config():
    """Experiment configuration validates correctly"""
    config = ExperimentConfig(
        experiment_id="test_001",
        model_name="gpt-4o-mini",
        prompt_version="v1"
    )
    assert config.temperature == 0.7  # Default value
```

```bash
# Run tests:
pytest tests/test_monitoring.py tests/test_benchmarking.py -v
```

### Level 3: Integration Test
```bash
# Test monitoring integration
python scripts/specbook_monitored.py

# Check monitoring output
cat data/metrics/pipeline_metrics.json

# Test benchmarking with cache
python scripts/run_benchmarks.py --use-cache --models gpt-4o-mini,gpt-3.5-turbo

# Verify report generation
cat data/benchmarks/comparison_report.md
```

### Level 4: End-to-End Validation
```bash
# Full pipeline test with monitoring
echo "https://example-product.com" > test_urls.csv
python scripts/specbook_monitored.py --input test_urls.csv

# Run benchmarks on same data
python scripts/run_benchmarks.py --input test_urls.csv --iterations 3

# Expected outputs:
# - 100% scraping success (or documented 404s)
# - Zero rate limit errors
# - Valid image URLs in all extractions
# - Benchmark report showing model comparisons
```

## Final Validation Checklist
- [ ] All tests pass: `pytest tests/ -v`
- [ ] No linting errors: `ruff check tools/ scripts/`
- [ ] No type errors: `mypy tools/ scripts/`
- [ ] Monitoring captures all pipeline stages
- [ ] Cache prevents duplicate scraping
- [ ] Benchmarks compare at least 3 models
- [ ] Reports include cost analysis
- [ ] Error categorization is comprehensive
- [ ] Documentation is clear and complete

---

## Anti-Patterns to Avoid
- ❌ Don't create complex monitoring infrastructure - keep it simple
- ❌ Don't ignore existing patterns in the codebase
- ❌ Don't skip error handling - categorize everything
- ❌ Don't hardcode model names or limits
- ❌ Don't store large amounts of data in memory
- ❌ Don't make synchronous LLM calls in benchmarking
- ❌ Don't forget to respect rate limits even with caching

## Additional Implementation Notes

### Error Handling Strategy
1. Network errors: Retry with exponential backoff
2. Bot detection: Fall back to Firecrawl
3. Rate limits: Use existing OpenAIRateLimiter
4. LLM errors: Log and continue with next item

### Performance Considerations
- Use ThreadPoolExecutor for parallel processing
- Batch database operations for metrics
- Stream large CSV files instead of loading entirely
- Implement progress bars for long operations

### Reporting Features
- Summary statistics (success rates, avg quality scores)
- Cost breakdown by model
- Error distribution charts
- Recommendations based on cost/quality trade-offs
- Export to CSV for further analysis

## Confidence Score: 8/10

The PRP provides comprehensive context and clear implementation steps. Points deducted for:
- Complexity of coordinating multiple components
- Potential edge cases in caching logic

However, the strong foundation of existing code patterns and clear validation steps should enable successful one-pass implementation.