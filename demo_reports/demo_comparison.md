# LLM Model Benchmarking Report

Generated: 2025-07-07 19:23:03

## Executive Summary
- **Recommended Model**: gpt-4o-mini
- **Reason**: Best overall balance of quality, cost, and speed
- **Best Quality**: gpt-4o (0.920)
- **Most Cost-Effective**: gpt-3.5-turbo ($0.0100)
- **Fastest**: gpt-4o-mini (2.00s avg)

## Test Configuration
- **Total URLs Tested**: 10
- **Models Compared**: gpt-4o-mini, gpt-4o, gpt-3.5-turbo
- **Prompt Template**: default

## Detailed Comparison

| Model | Success Rate | Avg Quality | Total Cost | Cost/URL | Avg Time | Tokens/sec |
|-------|-------------|-------------|------------|----------|----------|------------|
| gpt-4o-mini | 90.0% | 0.850 | $0.0300 | $0.0030 | 2.00s | 300 |
| gpt-4o | 100.0% | 0.920 | $0.1500 | $0.0150 | 2.50s | 280 |
| gpt-3.5-turbo | 90.0% | 0.780 | $0.0100 | $0.0010 | 3.00s | 260 |

## Quality Analysis

### gpt-4o-mini
- Average Quality Score: 0.850
- Score Distribution:
  - 0.8-1.0: 8 (88.9%)
  - 0.6-0.8: 2 (22.2%)

### gpt-4o
- Average Quality Score: 0.920
- Score Distribution:
  - 0.8-1.0: 8 (80.0%)
  - 0.6-0.8: 2 (20.0%)

### gpt-3.5-turbo
- Average Quality Score: 0.780
- Score Distribution:
  - 0.8-1.0: 8 (88.9%)
  - 0.6-0.8: 2 (22.2%)

## Common Issues by Model

## Cost Analysis

| Model | Total Cost | Per URL | Per 1K Tokens |
|-------|-----------|---------|---------------|
| gpt-4o-mini | $0.0300 | $0.0030 | $0.0060 |
| gpt-4o | $0.1500 | $0.0150 | $0.0250 |
| gpt-3.5-turbo | $0.0100 | $0.0010 | $0.0014 |

## Performance Metrics

### gpt-4o-mini
- Total Duration: 20.00s
- Average per URL: 2.00s
- Tokens per Second: 300
- Total Tokens Used: 5,000

### gpt-4o
- Total Duration: 25.00s
- Average per URL: 2.50s
- Tokens per Second: 280
- Total Tokens Used: 6,000

### gpt-3.5-turbo
- Total Duration: 30.00s
- Average per URL: 3.00s
- Tokens per Second: 260
- Total Tokens Used: 7,000

## Significant Findings
- Significant quality differences between models
- Cost varies by more than 2x between models

## Recommendations

**Use gpt-4o-mini for production** - Best overall balance of quality, cost, and speed

### Model Selection Guide:
- **For highest quality**: Use gpt-4o
- **For lowest cost**: Use gpt-3.5-turbo
- **For fastest processing**: Use gpt-4o-mini
