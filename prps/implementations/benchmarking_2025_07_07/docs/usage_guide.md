# Usage Guide: Benchmarking and Monitoring System

## Quick Commands

### Basic Benchmarking

**From Project Root (Recommended):**
```bash
# Quick test with 10 URLs
python prps/implementations/benchmarking_2025_07_07/scripts/run_benchmarks.py --quick-test

# Compare 3 models on 50 URLs
python prps/implementations/benchmarking_2025_07_07/scripts/run_benchmarks.py --models gpt-4o-mini,gpt-4o,gpt-3.5-turbo --limit 50

# Full benchmark without cache
python prps/implementations/benchmarking_2025_07_07/scripts/run_benchmarks.py --no-cache
```

**Via Workspace (Alternative):**
```bash
# Set up workspace first
python tools/workspace_manager.py setup --prp benchmarking

# Then run from workspace
python workspace/scripts/run_benchmarks.py --quick-test
python workspace/scripts/run_benchmarks.py --models gpt-4o-mini,gpt-4o,gpt-3.5-turbo --limit 50
```

### Monitoring Pipeline
```bash
# Run enhanced pipeline with monitoring (from project root)
python prps/implementations/benchmarking_2025_07_07/scripts/specbook_monitored.py

# Or via workspace
python workspace/scripts/specbook_monitored.py

# Check logs (new location)
tail -f executions/2025-07-07_benchmarking/results/logs/stealth_scraper.log
```

### Cache Management
```bash
# Force cache import from llm_results.csv
python prps/implementations/benchmarking_2025_07_07/scripts/run_benchmarks.py --force-cache-import

# Run without using cache
python prps/implementations/benchmarking_2025_07_07/scripts/run_benchmarks.py --no-cache

# Check cache status
python tools/workspace_manager.py status
```

## Understanding Results

### Console Output
- Real-time progress updates
- Cache hit/miss statistics  
- Success rates and quality scores
- Cost analysis per model

### Generated Reports
- **Reports:** `executions/YYYY-MM-DD_benchmarking/results/reports/` - Markdown and HTML reports
- **Raw Data:** `executions/YYYY-MM-DD_benchmarking/results/benchmarks/` - Raw experiment data
- **Charts:** Generated in reports (if matplotlib available)
- **Cache:** `shared/cache/` - Persistent cache with 60+ HTML files

### Cache Statistics
- Cache efficiency percentages
- Storage usage and hit rates
- Performance improvements

## Configuration Options

### Models
- `gpt-4o-mini` - Fast, cost-effective
- `gpt-4o` - High quality, expensive  
- `gpt-3.5-turbo` - Balanced option

### Parameters
- `--limit N` - Process only N URLs
- `--max-workers N` - Parallel workers (default: 5)
- `--temperature 0.7` - LLM creativity
- `--max-tokens 1000` - Response length

## Troubleshooting

### Common Issues
1. **Import errors** - Ensure Python path includes project root
2. **Cache misses** - Check if llm_results.csv exists and has HTML content
3. **Rate limits** - Built-in rate limiting handles this automatically
4. **Memory issues** - Reduce max-workers or URL limit

### Performance Tips
1. Use cache for model comparisons
2. Start with --quick-test for validation
3. Use --limit for large datasets
4. Monitor logs for scraping issues