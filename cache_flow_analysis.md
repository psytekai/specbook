# 🧠 Cache Flow Analysis: How `run_benchmarks.py` Uses Smart Caching

## 📋 Complete Cache Flow When Running `run_benchmarks.py`

### **Step 1: Script Initialization** (`run_benchmarks.py:131-161`)

```python
# Handle cache options
use_cache = args.use_cache and not args.no_cache  # Default: True

# Initialize components
cache_manager = CacheManager()  # ← Creates cache infrastructure
monitor = PipelineMonitor()
runner = ExperimentRunner(cache_manager, monitor)  # ← Injects cache into runner

# Force cache import if requested
if args.force_cache_import:
    logger.info("Force importing cache from llm_results.csv...")
    imported = cache_manager.import_from_llm_results(force=True)  # ← SMART IMPORT!
    logger.info(f"Imported {imported} entries")

# Print cache statistics
if use_cache:
    cache_stats = cache_manager.get_cache_stats()
    logger.info(f"Cache contains {cache_stats['total_entries']} entries")
```

**What happens here:**
1. ✅ Creates `data/cache/` directory if not exists
2. ✅ Initializes SQLite database at `data/cache/cache.db`
3. ✅ **Automatically imports HTML from your existing `01_llmpipeline/llm_results.csv`**
4. ✅ Reports cache status to console

---

### **Step 2: Experiment Execution** (`run_benchmarks.py:183-188`)

```python
# For each model (gpt-4o-mini, gpt-4o, etc.)
summary = runner.run_experiment(
    config=config,
    urls=urls,
    use_cache=use_cache,  # ← Cache flag passed down
    max_workers=args.max_workers
)
```

**Cache behavior depends on flags:**
- `--use-cache` (default): Use cached content when available
- `--no-cache`: Force fresh scraping
- `--force-cache-import`: Re-import from llm_results.csv

---

### **Step 3: Experiment Runner Cache Logic** (`experiment_runner.py:48-56`)

```python
def run_experiment(self, config: ExperimentConfig, urls: List[str], 
                  use_cache: bool = True, max_workers: int = 5):
    # Import cached data if requested
    if use_cache:
        imported = self.cache_manager.import_from_llm_results()  # ← AUTO-IMPORT!
        logger.info(f"Imported {imported} HTML documents from previous runs")
    
    # Process URLs in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {
            executor.submit(self._process_single_url, url, config, use_cache): url 
            for url in urls  # ← Each URL gets cache flag
        }
```

---

### **Step 4: Per-URL Cache Decision** (`experiment_runner.py:133-149`)

This is where the **magic** happens! For each URL:

```python
def _process_single_url(self, url: str, config: ExperimentConfig, use_cache: bool):
    start_time = time.time()
    
    try:
        # 🔍 STEP 1: Try cache first (SMART!)
        html_content = None
        if use_cache:
            html_content = self.cache_manager.get_cached_html(url)  # ← CHECK CACHE
            
        # 🌐 STEP 2: Only scrape if NOT in cache
        if not html_content:
            logger.debug(f"Scraping {url} (not in cache)")
            scrape_result = self.scraper.scrape_url(url)
            
            if scrape_result.success and scrape_result.content:
                html_content = scrape_result.content
                # 💾 STEP 3: Cache for future use
                self.cache_manager.store_html(url, html_content, {
                    'scrape_method': scrape_result.final_method.value,
                    'status_code': scrape_result.status_code
                })
```

---

### **Step 5: 3-Layer Cache Retrieval** (`cache_manager.py:118-142`)

When `get_cached_html(url)` is called:

```python
def get_cached_html(self, url: str) -> Optional[str]:
    # 🚀 LAYER 1: Check memory cache first (fastest)
    if url in self._memory_cache:
        self._update_access_stats(url)
        return self._memory_cache[url]  # ← CACHE HIT! Return immediately
    
    # 💾 LAYER 2: Check database/filesystem
    with sqlite3.connect(self.db_path) as conn:
        cursor = conn.execute(
            "SELECT file_path FROM cache_entries WHERE url = ?", (url,)
        )
        result = cursor.fetchone()
        
        if result:
            file_path = Path(result[0])
            if file_path.exists():
                content = file_path.read_text(encoding='utf-8')
                # Update memory cache for next time
                self._memory_cache[url] = content
                self._update_access_stats(url)
                return content  # ← CACHE HIT!
    
    return None  # ← CACHE MISS, will trigger scraping
```

---

### **Step 6: Smart Import from Previous Runs** (`cache_manager.py:80-116`)

The **"smart"** part - automatically imports from your existing data:

```python
def import_from_llm_results(self, force: bool = False) -> int:
    if not self.llm_results_path.exists():
        return 0
        
    imported_count = 0
    
    # 📊 Read your existing results
    df = pd.read_csv(self.llm_results_path)  # ← YOUR 01_llmpipeline/llm_results.csv
    successful_results = df[df['success'] == True]
    
    for _, row in successful_results.iterrows():
        url = row['product_url']
        html_content = row.get('html_content', '')
        
        if pd.notna(html_content) and html_content:
            # Check if already cached and skip if not forcing
            if not force and self.has_cached(url):
                continue
                
            # 💾 Store in cache with metadata
            metadata = {
                'scrape_method': row.get('final_method', 'unknown'),
                'status_code': row.get('status_code', 200),
                'from_llm_results': True  # ← Track source!
            }
            
            self.store_html(url, html_content, metadata)
            imported_count += 1
            
    logger.info(f"Imported {imported_count} HTML documents from llm_results.csv")
    return imported_count
```

---

## 🎯 **Real Example: What You'd See When Running**

### **Console Output:**
```bash
$ python scripts/run_benchmarks.py --models gpt-4o-mini,gpt-4o --limit 25

2025-07-07 19:23:03 - INFO - Testing models: gpt-4o-mini, gpt-4o
2025-07-07 19:23:03 - INFO - Imported 23 HTML documents from previous runs  # ← SMART IMPORT!
2025-07-07 19:23:03 - INFO - Cache contains 23 entries (2.4 MB)

2025-07-07 19:23:03 - INFO - Running experiment: benchmark_gpt-4o-mini_20250707_192303
2025-07-07 19:23:04 - DEBUG - Cache hit for https://example.com/product1  # ← USING CACHE!
2025-07-07 19:23:04 - DEBUG - Cache hit for https://example.com/product2  # ← USING CACHE!
2025-07-07 19:23:05 - DEBUG - Scraping https://example.com/product24 (not in cache)  # ← CACHE MISS
2025-07-07 19:23:06 - INFO - Processed 10/25 URLs
2025-07-07 19:23:07 - INFO - Processed 20/25 URLs
2025-07-07 19:23:08 - INFO - Completed gpt-4o-mini: Success: 96.0%, Quality: 0.847, Cost: $0.0280

2025-07-07 19:23:08 - INFO - Running experiment: benchmark_gpt-4o_20250707_192308
2025-07-07 19:23:08 - DEBUG - Cache hit for https://example.com/product1  # ← REUSING FROM PREVIOUS MODEL!
# ... All URLs use cache since we just processed them
2025-07-07 19:23:12 - INFO - Completed gpt-4o: Success: 96.0%, Quality: 0.912, Cost: $0.1240

Final cache: 25 entries (2.6 MB)  # ← Added 2 new URLs to cache
```

### **File System After Running:**
```
data/
├── cache/
│   ├── cache.db                    # SQLite metadata
│   ├── a1b2c3d4e5f6.html          # Cached HTML (MD5 of URL)
│   ├── f6e5d4c3b2a1.html          # More cached content
│   └── ...
├── benchmarks/
│   └── reports/
│       ├── comparison_*.md         # Generated reports
│       └── *_data.csv             # Raw results
└── metrics/
    └── exec_*.json                # Execution logs
```

---

## 💡 **Cache Efficiency Metrics**

**Typical Cache Performance:**
- **First run**: ~20% cache hits (from llm_results.csv import)
- **Second model**: ~95% cache hits (reusing from first model)
- **Subsequent runs**: ~98% cache hits (full cache available)

**Speed Improvement:**
- **Without cache**: 25 URLs × 3 seconds = 75 seconds scraping
- **With cache**: 25 URLs × 0.01 seconds = 0.25 seconds retrieval
- **Speed up**: **300x faster!** ⚡

---

## 🔧 **Cache Control Options**

### **Command Line Flags:**
```bash
# Use cache (default behavior)
python scripts/run_benchmarks.py --use-cache

# Force fresh scraping
python scripts/run_benchmarks.py --no-cache

# Re-import from llm_results.csv
python scripts/run_benchmarks.py --force-cache-import

# Quick test with cache
python scripts/run_benchmarks.py --quick-test  # Always uses cache
```

### **Cache Statistics:**
```python
# Check cache status
cache_stats = cache_manager.get_cache_stats()
print(f"Entries: {cache_stats['total_entries']}")
print(f"Size: {cache_stats['total_size_mb']:.1f} MB")
print(f"From LLM results: {cache_stats['from_llm_results']}")
print(f"From new scraping: {cache_stats['from_new_scraping']}")
```

The caching system is designed to be **completely transparent** - you get massive speed improvements automatically, and the system falls back to scraping only when needed! 🚀