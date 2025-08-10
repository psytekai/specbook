# Cache Implementation Plan for Specbook Pipeline

## Current Situation Analysis

### Cache Usage Status: ❌ NOT IMPLEMENTED

The `specbook_monitored.py` script **does not use any caching mechanism** and will make fresh API calls to Firecrawl for every execution, resulting in unnecessary credit consumption.

### Current Scraping Flow
```python
# Line 76: Direct scraping without cache check
for id, product_search_result in zip(df['id'], executor.map(stealth_scraper.scrape_url, df['product_url'].to_list())):
```

### Existing Cache Infrastructure Available

The codebase already contains a sophisticated `CacheManager` class with these capabilities:
- **SQLite database** for metadata tracking
- **File-based HTML storage** (`.html` files)
- **Memory cache** for frequently accessed content
- **Import capabilities** from existing CSV results
- **Batch operations** for efficient retrieval

**Location**: `/lib/benchmarking/cache_manager.py`

## Implementation Plan

### Option 1: Integrate Existing CacheManager (Recommended)

This approach leverages the existing caching infrastructure with minimal code changes.

#### Step 1: Import CacheManager
**File**: `workspace/scripts/specbook_monitored.py`
**Location**: After line 8

```python
from lib.benchmarking import CacheManager
```

#### Step 2: Initialize Cache Manager
**File**: `workspace/scripts/specbook_monitored.py`
**Location**: After line 30

```python
# Initialize cache
cache_manager = CacheManager()
```

#### Step 3: Add Cache Parameter to Main Function
**File**: `workspace/scripts/specbook_monitored.py`
**Location**: Line 56

```python
def main(input_file: str = "workspace/input/specbook.csv", 
         output_dir: str = "workspace/output",
         model_name: str = "gpt-4o-mini",
         use_cache: bool = True):  # Add cache parameter
```

#### Step 4: Replace Scraping Logic with Cache-Aware Version
**File**: `workspace/scripts/specbook_monitored.py`
**Location**: Lines 75-91

```python
# STEP 1: Scrape product sites with caching
logger.info("Starting web scraping phase...")
product_scrape_results = []

def scrape_with_cache(url: str):
    """Scrape URL with cache fallback"""
    # Check cache first
    if use_cache:
        cached_html = cache_manager.get_cached_html(url)
        if cached_html:
            logger.info(f"Cache hit for {url}")
            # Create a mock ScrapeResult for cached content
            from lib.core.scraping import ScrapeResult, ScrapeMethod
            return ScrapeResult(
                url=url,
                success=True,
                content=cached_html,
                status_code=200,
                final_method=ScrapeMethod.CACHED,  # Need to add this to enum
                error_reason="",
                page_issues=[],
                response_time=0.0
            )
    
    # Cache miss - perform actual scraping
    logger.info(f"Cache miss for {url}, scraping...")
    scrape_result = stealth_scraper.scrape_url(url)
    
    # Store successful results in cache
    if scrape_result.success and scrape_result.content and use_cache:
        cache_manager.store_html(url, scrape_result.content, {
            'scrape_method': scrape_result.final_method.value,
            'status_code': scrape_result.status_code,
            'response_time': scrape_result.response_time
        })
    
    return scrape_result

# Use cache-aware scraping
with ThreadPoolExecutor(max_workers=10) as executor:
    for id, product_search_result in zip(df['id'], executor.map(scrape_with_cache, df['product_url'].to_list())):
        # Record scraping metrics
        monitor.record_scrape_result(product_search_result, stage=PipelineStage.SCRAPING)
        
        product_scrape_results.append({
            'id': id,
            'product_url': product_search_result.url,
            'success': product_search_result.success,
            'content_length': len(product_search_result.content) if product_search_result.content else 0,
            'status_code': product_search_result.status_code,
            'final_method': product_search_result.final_method,
            'error_reason': product_search_result.error_reason,
            'page_issues': product_search_result.page_issues,
            'html_content': product_search_result.content,
            'full_result': product_search_result.model_dump_json()
        })
```

#### Step 5: Update CLI Arguments
**File**: `workspace/scripts/specbook_monitored.py`
**Location**: Lines 247-257

```python
parser.add_argument("--use-cache", action="store_true", default=True,
                   help="Use cached HTML content when available")
parser.add_argument("--no-cache", dest="use_cache", action="store_false",
                   help="Disable cache usage and always scrape fresh")

args = parser.parse_args()
main(input_file=args.input, output_dir=args.output_dir, 
     model_name=args.model, use_cache=args.use_cache)
```

#### Step 6: Add CACHED Method to ScrapeMethod Enum
**File**: `/lib/core/scraping.py`
**Location**: In ScrapeMethod enum

```python
class ScrapeMethod(Enum):
    REQUESTS = "requests"
    FIRECRAWL = "firecrawl"
    CACHED = "cached"  # Add this
```

### Option 2: Simple File-Based Cache (Alternative)

If the existing CacheManager is too complex, implement a simple file-based cache.

#### Step 1: Create Simple Cache Function
```python
import hashlib
import json
from pathlib import Path

def get_cache_path(url: str) -> Path:
    """Generate cache file path for URL"""
    url_hash = hashlib.md5(url.encode()).hexdigest()
    return Path(f"workspace/cache/{url_hash}.json")

def load_from_cache(url: str) -> Optional[dict]:
    """Load cached result for URL"""
    cache_path = get_cache_path(url)
    if cache_path.exists():
        with open(cache_path, 'r') as f:
            return json.load(f)
    return None

def save_to_cache(url: str, scrape_result: dict):
    """Save scrape result to cache"""
    cache_path = get_cache_path(url)
    cache_path.parent.mkdir(exist_ok=True)
    with open(cache_path, 'w') as f:
        json.dump(scrape_result, f)
```

## Benefits of Cache Implementation

### Cost Savings
- **Avoid repeated Firecrawl API calls** for the same URLs
- **Reduce credit consumption** during development and testing
- **Enable fast re-runs** during pipeline iteration

### Performance Benefits
- **Faster execution** for cached URLs
- **Reduced network latency** 
- **More predictable execution times**

### Development Benefits
- **Consistent test data** across runs
- **Offline development** capability
- **Easier debugging** with stable content

## Implementation Priority

### High Priority (Immediate)
1. **Add cache parameter** to main function
2. **Integrate existing CacheManager** (Option 1)
3. **Update CLI arguments** for cache control

### Medium Priority
1. **Add cache statistics** to monitoring output
2. **Cache invalidation** mechanisms
3. **Cache size management**

### Low Priority
1. **Cache warming** utilities
2. **Cache compression** for large HTML files
3. **Distributed caching** for multiple workers

## Testing Strategy

### Pre-Implementation
1. **Run pipeline** with current URLs and note Firecrawl usage
2. **Identify repeated URLs** in input data
3. **Measure baseline execution time**

### Post-Implementation
1. **First run**: Should populate cache and use Firecrawl as normal
2. **Second run**: Should use cache for all URLs, zero Firecrawl calls
3. **Mixed run**: Should use cache for existing URLs, Firecrawl for new ones

### Validation Criteria
- ✅ **Zero Firecrawl calls** for cached URLs
- ✅ **Identical extraction results** between cached and fresh content
- ✅ **Significant performance improvement** on subsequent runs
- ✅ **Proper cache hit/miss logging**

## Risk Assessment

### Low Risk
- Using existing CacheManager infrastructure
- Adding optional cache parameter

### Medium Risk
- Modifying scraping logic
- Adding new dependencies

### Mitigation
- **Default to cache enabled** for cost savings
- **Provide --no-cache flag** for debugging
- **Comprehensive logging** of cache operations
- **Fallback to fresh scraping** if cache fails

## Expected Impact

### Before Implementation
```
100 URLs × 1 Firecrawl call = 100 credits per run
Multiple test runs = 500+ credits
```

### After Implementation
```
First run: 100 URLs × 1 Firecrawl call = 100 credits
Subsequent runs: 0 credits (all cached)
Development savings: 80-90% credit reduction
```

This implementation will provide immediate cost savings while maintaining all existing functionality and enabling faster development iteration.