# How to Run the Benchmarking & Monitoring System

## 🚀 Quick Start (Recommended)

### 1. Test the System with Existing Data
```bash
# Quick benchmark test using cached data (fastest way to see results)
python scripts/run_benchmarks.py --quick-test

# Compare 3 models on first 10 URLs from your existing data
python scripts/run_benchmarks.py --models gpt-4o-mini,gpt-4o,gpt-3.5-turbo --limit 10 --use-cache
```

### 2. Run Monitored Pipeline on Your Data
```bash
# Run the enhanced pipeline with monitoring
python scripts/specbook_monitored.py --model gpt-4o-mini --limit 5

# Full run with best model
python scripts/specbook_monitored.py --model gpt-4o
```

## 📊 What You'll See

### Console Output Example:
```
2025-07-07 19:23:03 - INFO - Started pipeline execution exec_20250707_192303 for 25 URLs
2025-07-07 19:23:05 - INFO - Starting web scraping phase...

=== Scraping Summary ===
success  status_code  final_method
True     200.0        requests        20
False    403.0        firecrawl        3
True     200.0        firecrawl        2
========================

2025-07-07 19:23:45 - INFO - Processing HTML and generating prompts...
2025-07-07 19:23:50 - INFO - Starting LLM extraction with model gpt-4o-mini...

=== Pipeline Execution Summary ===
Execution ID: exec_20250707_192303
Started: 2025-07-07T19:23:03

Progress: 25/25 URLs processed
  Successful: 22
  Failed: 3

Errors:
  Bot Detections: 2
  Rate Limits: 0
  Network Errors: 1
  Validation Errors: 0

Cost:
  Total: $0.0340
  OpenAI: $0.0340
  Firecrawl: $0.0000
================================
```

### Generated Files:
```
📊 Monitoring Results:
data/metrics/exec_20250707_192303.json     # Raw execution data
01_llmpipeline/execution_report_*.md        # Human-readable report

📈 Benchmark Results:
data/benchmarks/reports/benchmark_*.md      # Full comparison
data/benchmarks/reports/*_executive_summary.md  # Executive summary
data/benchmarks/reports/*_data.csv          # Raw data export

💾 Cached Data:
data/cache/                                 # HTML cache for faster iteration
```

## 🎯 Real Example Results

### Sample Executive Summary:
```markdown
# Executive Summary - LLM Model Benchmarking

## Key Findings
- **Recommended Model**: **gpt-4o-mini**
- **Rationale**: Best overall balance of quality, cost, and speed

## Quick Comparison
| Model | Quality | Cost | Speed | Overall |
|-------|---------|------|-------|---------|
| gpt-4o-mini | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 🏆 |
| gpt-4o | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ✓ |
| gpt-3.5-turbo | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ✓ |

## Bottom Line
Switch to **gpt-4o-mini** for optimal results.
- Potential cost savings: 78%
- Quality improvement: +0.067
```

### Sample Detailed Metrics:
```markdown
## Detailed Comparison
| Model | Success Rate | Avg Quality | Total Cost | Cost/URL | Avg Time |
|-------|-------------|-------------|------------|----------|----------|
| gpt-4o-mini | 92.0% | 0.847 | $0.0280 | $0.0011 | 1.8s |
| gpt-4o | 96.0% | 0.912 | $0.1240 | $0.0050 | 2.1s |
| gpt-3.5-turbo | 88.0% | 0.780 | $0.0085 | $0.0003 | 2.3s |

## Error Breakdown
- Bot Detections: 3 (12% of failures)
- Network Errors: 1 (4% of failures)
- Rate Limits: 0 (0% of failures)
```

## 💡 Advanced Usage

### Custom Configurations:
```bash
# Test specific models with custom settings
python scripts/run_benchmarks.py \
  --models gpt-4o-mini,gpt-4o \
  --limit 50 \
  --temperature 0.3 \
  --max-tokens 1500 \
  --max-workers 3

# Run with custom input file
python scripts/specbook_monitored.py \
  --input custom_urls.csv \
  --output-dir results/custom_run/ \
  --model gpt-4o

# Force fresh scraping (ignore cache)
python scripts/run_benchmarks.py \
  --no-cache \
  --models gpt-4o-mini \
  --limit 10
```

### Integration with Existing Workflow:
```bash
# 1. Run your normal pipeline first
python scripts/specbook.py

# 2. Then run benchmarks using the cached data
python scripts/run_benchmarks.py --use-cache --models gpt-4o-mini,gpt-4o

# 3. Compare results and optimize
python scripts/specbook_monitored.py --model gpt-4o-mini  # Use the winner
```

## 🔧 Prerequisites

### Required:
- OpenAI API key: `export OPENAI_API_KEY=your_key_here`
- Existing specbook.csv file (you have this!)

### Optional:
- Firecrawl API key for fallback scraping: `export FIRECRAWL_API_KEY=your_key`
- matplotlib/seaborn for chart generation: `pip install matplotlib seaborn`

## 📈 Interpreting Results

### Quality Scores (0-1 scale):
- **0.9+**: Excellent extraction quality
- **0.8-0.9**: Good quality, minor issues
- **0.7-0.8**: Acceptable, some improvements needed
- **<0.7**: Poor quality, needs attention

### Cost Optimization:
- **gpt-3.5-turbo**: Cheapest but lower quality
- **gpt-4o-mini**: Best balance of cost/quality ⭐
- **gpt-4o**: Highest quality but most expensive

### Success Rate Targets:
- **95%+**: Excellent pipeline health
- **90-95%**: Good, monitor error patterns
- **<90%**: Investigate scraping issues

## 🎯 Next Steps After Running

1. **Review the executive summary** for quick insights
2. **Check error patterns** in the detailed report
3. **Optimize based on recommendations**:
   - Switch to recommended model
   - Address common error patterns
   - Adjust scraping strategies if needed
4. **Monitor ongoing performance** with regular benchmark runs

Ready to see real results? Run the quick test now:
```bash
python scripts/run_benchmarks.py --quick-test
```