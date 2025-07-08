#!/usr/bin/env python3
"""
Demo script to show how to use the benchmarking and monitoring system.

This script demonstrates the key features without requiring the full pipeline setup.
"""
import pandas as pd
from datetime import datetime
from pathlib import Path

# Create demo data
def create_demo_data():
    """Create demo CSV file with product URLs for testing"""
    demo_urls = [
        "https://www.homedepot.com/p/Whirlpool-24-in-Stainless-Steel-Front-Control-Built-In-Tall-Tub-Dishwasher-with-Stainless-Steel-Tub-53-dBA-WDF520PADM/203547782",
        "https://www.lowes.com/pd/GE-Profile-30-in-Smart-Slide-In-Electric-Range-with-Convection-Oven-Stainless-Steel/1002650896",
        "https://www.wayfair.com/furniture/pdp/mercury-row-calla-upholstered-dining-chair-w002658923.html"
    ]
    
    # Create demo CSV
    demo_df = pd.DataFrame({
        'product_url': demo_urls,
        'product_name': ['Demo Dishwasher', 'Demo Range', 'Demo Chair'],
        'project': 'Demo Project'
    })
    
    demo_df.to_csv('demo_urls.csv', index=False)
    print(f"✓ Created demo_urls.csv with {len(demo_urls)} URLs")
    return 'demo_urls.csv'

def demonstrate_monitoring():
    """Show how monitoring works with mock data"""
    print("\n" + "="*60)
    print("DEMONSTRATION: Pipeline Monitoring")
    print("="*60)
    
    from tools.monitoring.pipeline_monitor import PipelineMonitor
    from tools.monitoring.models import PipelineStage, ErrorCategory
    from tools.stealth_scraper import ScrapeResult, ScrapingMethod
    
    # Create monitor
    monitor = PipelineMonitor()
    
    # Start execution
    execution_id = monitor.start_execution(total_urls=3)
    print(f"Started execution: {execution_id}")
    
    # Simulate successful scraping
    for i in range(2):
        result = ScrapeResult(
            success=True,
            url=f"https://example.com/product{i+1}",
            status_code=200,
            content=f"<html>Product {i+1} content</html>",
            final_url=f"https://example.com/product{i+1}",
            final_method=ScrapingMethod.REQUESTS
        )
        monitor.record_scrape_result(result)
    
    # Simulate failed scraping
    failed_result = ScrapeResult(
        success=False,
        url="https://example.com/product3",
        status_code=403,
        content=None,
        final_url="https://example.com/product3",
        final_method=ScrapingMethod.REQUESTS,
        error_reason="Bot detected"
    )
    monitor.record_scrape_result(failed_result)
    
    # Simulate LLM calls
    monitor.record_llm_result(success=True, model="gpt-4o-mini", tokens_used=800, cost=0.0012)
    monitor.record_llm_result(success=True, model="gpt-4o-mini", tokens_used=750, cost=0.0011)
    
    # End execution and show results
    execution = monitor.end_execution()
    monitor.print_summary()
    
    return execution

def demonstrate_caching():
    """Show how caching works"""
    print("\n" + "="*60)
    print("DEMONSTRATION: HTML Caching")
    print("="*60)
    
    from tools.benchmarking.cache_manager import CacheManager
    
    # Create cache manager
    cache = CacheManager(cache_dir="demo_cache")
    
    # Store some HTML
    test_urls = [
        "https://example.com/product1",
        "https://example.com/product2",
        "https://example.com/product3"
    ]
    
    for i, url in enumerate(test_urls):
        html_content = f"<html><body>Product {i+1} page content with specifications</body></html>"
        success = cache.store_html(url, html_content, {
            'scrape_method': 'requests',
            'status_code': 200
        })
        print(f"✓ Cached {url}: {success}")
    
    # Test retrieval
    print("\nTesting cache retrieval:")
    for url in test_urls:
        cached = cache.get_cached_html(url)
        if cached:
            print(f"✓ Retrieved {url}: {len(cached)} chars")
        else:
            print(f"✗ Not found: {url}")
    
    # Show cache stats
    stats = cache.get_cache_stats()
    print(f"\nCache Statistics:")
    print(f"- Total entries: {stats['total_entries']}")
    print(f"- Total size: {stats['total_size_mb']:.2f} MB")
    
    return cache

def demonstrate_benchmarking():
    """Show benchmarking capabilities with mock data"""
    print("\n" + "="*60)
    print("DEMONSTRATION: Model Benchmarking")
    print("="*60)
    
    from tools.benchmarking.models import (
        ExperimentConfig, ExperimentSummary, QualityMetrics
    )
    from tools.benchmarking.report_generator import ReportGenerator
    
    # Create mock experiment summaries
    models = ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]
    summaries = {}
    
    for i, model in enumerate(models):
        config = ExperimentConfig(
            experiment_id=f"demo_{model}",
            model_name=model
        )
        
        # Mock quality scores (gpt-4o best, 3.5-turbo cheapest)
        if model == "gpt-4o":
            quality = 0.92
            cost = 0.15
        elif model == "gpt-4o-mini":
            quality = 0.85
            cost = 0.03
        else:  # gpt-3.5-turbo
            quality = 0.78
            cost = 0.01
        
        summary = ExperimentSummary(
            config=config,
            total_urls=10,
            successful_extractions=9 + i % 2,  # Vary success slightly
            failed_extractions=1 - i % 2,
            total_cost=cost,
            total_tokens=5000 + i * 1000,
            avg_execution_time=2.0 + i * 0.5,
            success_rate=(9 + i % 2) / 10,
            avg_quality_score=quality,
            quality_score_distribution={"0.8-1.0": 8, "0.6-0.8": 2},
            common_issues={},
            tokens_per_second=300 - i * 20,
            cost_per_url=cost / 10,
            started_at=datetime.now(),
            completed_at=datetime.now(),
            duration_seconds=20.0 + i * 5,
            results=[]
        )
        summaries[model] = summary
    
    # Generate comparison report
    report_gen = ReportGenerator(output_dir="demo_reports")
    Path("demo_reports").mkdir(exist_ok=True)
    
    try:
        report_path = report_gen.generate_comparison_report(summaries, "demo_comparison")
        print(f"✓ Generated comparison report: {report_path}")
        
        # Show key findings
        comparison = report_gen._create_benchmark_comparison(summaries)
        print(f"\nKey Findings:")
        print(f"- Best Quality: {comparison.best_quality_model}")
        print(f"- Most Cost-Effective: {comparison.best_cost_model}")
        print(f"- Recommended: {comparison.recommended_model}")
        print(f"- Reason: {comparison.recommendation_reason}")
        
    except Exception as e:
        print(f"Report generation failed: {e}")
        print("This is normal if matplotlib is not installed")

def show_usage_examples():
    """Show practical usage examples"""
    print("\n" + "="*60)
    print("HOW TO USE THE SYSTEM")
    print("="*60)
    
    print("\n1. BASIC MONITORING:")
    print("   python scripts/specbook_monitored.py")
    print("   - Runs original pipeline with monitoring")
    print("   - Generates execution report")
    print("   - Tracks all metrics and errors")
    
    print("\n2. QUICK BENCHMARK TEST:")
    print("   python scripts/run_benchmarks.py --quick-test")
    print("   - Tests gpt-4o-mini on 10 URLs")
    print("   - Uses cached content")
    print("   - Generates comparison report")
    
    print("\n3. MULTI-MODEL COMPARISON:")
    print("   python scripts/run_benchmarks.py --models gpt-4o-mini,gpt-4o,gpt-3.5-turbo --limit 25")
    print("   - Compares 3 models on 25 URLs")
    print("   - Shows quality vs cost trade-offs")
    print("   - Recommends optimal model")
    
    print("\n4. PRODUCTION MONITORING:")
    print("   python scripts/specbook_monitored.py --model gpt-4o --output-dir results/")
    print("   - Full pipeline with best model")
    print("   - Comprehensive error tracking")
    print("   - Professional reporting")

def show_expected_outputs():
    """Show what outputs to expect"""
    print("\n" + "="*60)
    print("EXPECTED OUTPUTS")
    print("="*60)
    
    print("\n📊 MONITORING OUTPUTS:")
    print("- data/metrics/exec_YYYYMMDD_HHMMSS.json  # Detailed execution data")
    print("- 01_llmpipeline/execution_report_*.md     # Human-readable report")
    print("- Console: Real-time progress and summary")
    
    print("\n📈 BENCHMARKING OUTPUTS:")
    print("- data/benchmarks/reports/comparison_*.md  # Full comparison report")
    print("- data/benchmarks/reports/*_summary.md     # Executive summary")
    print("- data/benchmarks/reports/*_data.csv       # Raw data export")
    print("- data/benchmarks/reports/*_charts/        # Visualization charts")
    
    print("\n💾 CACHE OUTPUTS:")
    print("- data/cache/*.html                        # Cached HTML content")
    print("- data/cache/cache.db                      # SQLite metadata")
    
    print("\n📋 EXAMPLE CONSOLE OUTPUT:")
    print("""
=== Pipeline Execution Summary ===
Execution ID: exec_20250707_184530
Started: 2025-07-07T18:45:30

Progress: 25/25 URLs processed
  Successful: 23
  Failed: 2

Errors:
  Bot Detections: 1
  Rate Limits: 0
  Network Errors: 1
  Validation Errors: 0

Cost:
  Total: $0.0450
  OpenAI: $0.0450
  Firecrawl: $0.0000
================================
    """)

def main():
    """Run the full demonstration"""
    print("🚀 BENCHMARKING & MONITORING SYSTEM DEMO")
    print("="*60)
    print("This demo shows the key features without requiring full setup.")
    
    # Create demo data
    demo_file = create_demo_data()
    
    # Run demonstrations
    execution = demonstrate_monitoring()
    cache = demonstrate_caching()
    demonstrate_benchmarking()
    
    # Show usage and outputs
    show_usage_examples()
    show_expected_outputs()
    
    print("\n🎯 NEXT STEPS:")
    print("1. Check that you have OpenAI API key set: export OPENAI_API_KEY=your_key")
    print("2. Try the quick test: python scripts/run_benchmarks.py --quick-test")
    print("3. Run with your data: python scripts/specbook_monitored.py")
    print("4. Compare models: python scripts/run_benchmarks.py --models gpt-4o-mini,gpt-4o")
    
    print("\n✅ Demo completed! The system is ready to use.")

if __name__ == "__main__":
    main()