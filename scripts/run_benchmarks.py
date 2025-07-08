#!/usr/bin/env python3
"""
Benchmark runner for comparing different LLM models and prompts on product extraction tasks.

This script orchestrates full benchmark runs, comparing models like gpt-4o-mini, gpt-4o, 
and gpt-3.5-turbo on the same dataset to identify optimal configurations.
"""
import argparse
import logging
import sys
from pathlib import Path
from typing import List

# Add project root to path
sys.path.append(str(Path(__file__).parent.parent))

from tools.benchmarking.experiment_runner import ExperimentRunner
from tools.benchmarking.cache_manager import CacheManager
from tools.benchmarking.report_generator import ReportGenerator
from tools.benchmarking.models import ExperimentConfig
from tools.monitoring.pipeline_monitor import PipelineMonitor
import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_urls_from_csv(file_path: str, limit: int = 0) -> List[str]:
    """Load product URLs from CSV file"""
    try:
        df = pd.read_csv(file_path)
        
        # Determine URL column name
        url_column = None
        for col in ['product_url', 'url', 'Product_URL', 'URL']:
            if col in df.columns:
                url_column = col
                break
        
        if not url_column:
            raise ValueError("No URL column found. Expected 'product_url', 'url', etc.")
        
        urls = df[url_column].dropna().tolist()
        
        if limit:
            urls = urls[:limit]
            
        logger.info(f"Loaded {len(urls)} URLs from {file_path}")
        return urls
        
    except Exception as e:
        logger.error(f"Error loading URLs from {file_path}: {e}")
        raise


def main():
    parser = argparse.ArgumentParser(
        description="Run LLM model benchmarking experiments",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Compare 3 models on 50 URLs using cache
  python run_benchmarks.py --models gpt-4o-mini,gpt-4o,gpt-3.5-turbo --limit 50 --use-cache
  
  # Quick test with 10 URLs
  python run_benchmarks.py --quick-test
  
  # Full benchmark without cache
  python run_benchmarks.py --models gpt-4o-mini,gpt-4o --no-cache
  
  # Custom input file
  python run_benchmarks.py --input data/test_urls.csv --models gpt-4o-mini
        """
    )
    
    # Input options
    parser.add_argument("--input", default="01_llmpipeline/specbook.csv",
                       help="Input CSV file with product URLs")
    parser.add_argument("--limit", type=int, 
                       help="Limit number of URLs to test (useful for quick tests)")
    
    # Model selection
    parser.add_argument("--models", default="gpt-4o-mini,gpt-4o,gpt-3.5-turbo",
                       help="Comma-separated list of models to test")
    parser.add_argument("--quick-test", action="store_true",
                       help="Run quick test with 10 URLs and gpt-4o-mini only")
    
    # Cache options
    parser.add_argument("--use-cache", action="store_true", default=True,
                       help="Use cached HTML content (default: True)")
    parser.add_argument("--no-cache", action="store_true",
                       help="Force fresh scraping, ignore cache")
    parser.add_argument("--force-cache-import", action="store_true",
                       help="Force re-import from llm_results.csv")
    
    # Execution options
    parser.add_argument("--max-workers", type=int, default=5,
                       help="Maximum parallel workers for processing")
    parser.add_argument("--iterations", type=int, default=1,
                       help="Number of iterations per model (for variance analysis)")
    
    # Output options
    parser.add_argument("--output-dir", default="data/benchmarks",
                       help="Output directory for results")
    parser.add_argument("--report-name", 
                       help="Custom name for the benchmark report")
    parser.add_argument("--no-charts", action="store_true",
                       help="Skip chart generation")
    
    # Advanced options
    parser.add_argument("--prompt-template", default="default",
                       help="Prompt template to use")
    parser.add_argument("--temperature", type=float, default=0.7,
                       help="LLM temperature setting")
    parser.add_argument("--max-tokens", type=int, default=1000,
                       help="Maximum tokens for LLM response")
    
    args = parser.parse_args()
    
    # Handle quick test mode
    if args.quick_test:
        args.models = "gpt-4o-mini"
        args.limit = 10
        args.use_cache = True
        logger.info("Quick test mode: testing gpt-4o-mini on 10 URLs")
    
    # Handle cache options
    use_cache = args.use_cache and not args.no_cache
    
    try:
        # Initialize components
        cache_manager = CacheManager()
        monitor = PipelineMonitor()
        runner = ExperimentRunner(cache_manager, monitor)
        report_generator = ReportGenerator(args.output_dir + "/reports")
        
        # Load URLs
        urls = load_urls_from_csv(args.input, args.limit)
        if not urls:
            logger.error("No URLs loaded, cannot proceed")
            return 1
        
        # Parse models
        models = [m.strip() for m in args.models.split(",")]
        logger.info(f"Testing models: {', '.join(models)}")
        
        # Force cache import if requested
        if args.force_cache_import:
            logger.info("Force importing cache from llm_results.csv...")
            imported = cache_manager.import_from_llm_results(force=True)
            logger.info(f"Imported {imported} entries")
        
        # Print cache statistics
        if use_cache:
            cache_stats = cache_manager.get_cache_stats()
            logger.info(f"Cache contains {cache_stats['total_entries']} entries "
                       f"({cache_stats['total_size_mb']:.1f} MB)")
        
        # Run experiments
        experiment_summaries = {}
        
        for iteration in range(args.iterations):
            iteration_suffix = f"_iter{iteration+1}" if args.iterations > 1 else ""
            
            for model in models:
                experiment_id = f"benchmark_{model}_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}{iteration_suffix}"
                
                config = ExperimentConfig(
                    experiment_id=experiment_id,
                    model_name=model,
                    prompt_template=args.prompt_template,
                    temperature=args.temperature,
                    max_tokens=args.max_tokens
                )
                
                logger.info(f"Running experiment: {experiment_id}")
                
                try:
                    summary = runner.run_experiment(
                        config=config,
                        urls=urls,
                        use_cache=use_cache,
                        max_workers=args.max_workers
                    )
                    
                    # For multiple iterations, average the results
                    if args.iterations > 1:
                        if model in experiment_summaries:
                            # Combine with previous iteration (simplified averaging)
                            prev_summary = experiment_summaries[model]
                            # This is a simplified combination - in practice you'd want more sophisticated averaging
                            summary.avg_quality_score = (prev_summary.avg_quality_score + summary.avg_quality_score) / 2
                            summary.total_cost += prev_summary.total_cost
                            summary.avg_execution_time = (prev_summary.avg_execution_time + summary.avg_execution_time) / 2
                    
                    experiment_summaries[model] = summary
                    
                    # Print quick results
                    logger.info(f"Completed {model}: "
                               f"Success: {summary.success_rate:.1%}, "
                               f"Quality: {summary.avg_quality_score:.3f}, "
                               f"Cost: ${summary.total_cost:.4f}")
                               
                except Exception as e:
                    logger.error(f"Failed to run experiment for {model}: {e}")
                    continue
        
        if not experiment_summaries:
            logger.error("No experiments completed successfully")
            return 1
        
        # Generate reports
        logger.info("Generating comparison report...")
        
        report_name = args.report_name or f"benchmark_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            if not args.no_charts:
                # Generate full report with charts
                report_path = report_generator.generate_comparison_report(
                    experiment_summaries, report_name
                )
                logger.info(f"Full report generated: {report_path}")
            else:
                # Generate markdown report only
                comparison = report_generator._create_benchmark_comparison(experiment_summaries)
                markdown_report = report_generator._generate_markdown_report(comparison, experiment_summaries)
                
                report_path = Path(args.output_dir) / "reports" / f"{report_name}.md"
                report_path.parent.mkdir(exist_ok=True, parents=True)
                
                with open(report_path, 'w') as f:
                    f.write(markdown_report)
                logger.info(f"Markdown report generated: {report_path}")
            
            # Generate CSV comparison
            csv_path = report_generator.generate_csv_comparison(
                experiment_summaries, 
                str(Path(args.output_dir) / "reports" / f"{report_name}_data.csv")
            )
            logger.info(f"CSV data exported: {csv_path}")
            
        except Exception as e:
            logger.error(f"Error generating reports: {e}")
            # Still print basic comparison to console
            print("\n" + "="*60)
            print("BENCHMARK RESULTS SUMMARY")
            print("="*60)
            for model, summary in experiment_summaries.items():
                print(f"\n{model}:")
                print(f"  Success Rate: {summary.success_rate:.1%}")
                print(f"  Avg Quality:  {summary.avg_quality_score:.3f}")
                print(f"  Total Cost:   ${summary.total_cost:.4f}")
                print(f"  Avg Time:     {summary.avg_execution_time:.2f}s")
        
        # Print final cache statistics
        if use_cache:
            final_cache_stats = cache_manager.get_cache_stats()
            logger.info(f"Final cache: {final_cache_stats['total_entries']} entries "
                       f"({final_cache_stats['total_size_mb']:.1f} MB)")
        
        logger.info("Benchmarking completed successfully!")
        return 0
        
    except KeyboardInterrupt:
        logger.info("Benchmarking interrupted by user")
        return 1
    except Exception as e:
        logger.error(f"Benchmarking failed: {e}")
        return 1


if __name__ == "__main__":
    exit(main())