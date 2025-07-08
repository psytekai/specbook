"""Enhanced specbook pipeline with integrated monitoring"""
import sys
from pathlib import Path

# Add project root to path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from lib.core import HTMLProcessor, PromptTemplator, LLMInvocator, StealthScraper
from lib.monitoring import PipelineMonitor
from lib.monitoring.models import PipelineStage, MetricType, ErrorCategory
import pandas as pd
from concurrent.futures import ThreadPoolExecutor
import logging
import time
import argparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Initialize tools
stealth_scraper = StealthScraper()
html_processor = HTMLProcessor()
prompt_templator = PromptTemplator()
llm_invocator = LLMInvocator()
monitor = PipelineMonitor()


def estimate_llm_cost(model: str, prompt_len: int, response_len: int = 1000) -> float:
    """Estimate cost based on model and token counts"""
    # Rough estimation: 1 token ≈ 4 characters
    prompt_tokens = prompt_len // 4
    response_tokens = response_len // 4
    total_tokens = prompt_tokens + response_tokens
    
    # Pricing per 1K tokens (as of 2024)
    pricing = {
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},  # per 1K tokens
        "gpt-4o": {"input": 0.005, "output": 0.015},
        "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015}
    }
    
    if model not in pricing:
        return 0.0
        
    input_cost = (prompt_tokens / 1000) * pricing[model]["input"]
    output_cost = (response_tokens / 1000) * pricing[model]["output"]
    
    return input_cost + output_cost


def main(input_file: str = "workspace/input/specbook.csv", 
         output_dir: str = "workspace/output",
         model_name: str = "gpt-4o-mini"):
    """Main pipeline execution with monitoring"""
    
    # Load input data
    logger.info(f"Loading URLs from {input_file}")
    df = pd.read_csv(input_file)
    df['id'] = range(1, len(df) + 1)
    
    # Start monitoring
    execution_id = monitor.start_execution(total_urls=len(df))
    logger.info(f"Started pipeline execution: {execution_id}")
    
    try:
        # STEP 1: Scrape product sites
        logger.info("Starting web scraping phase...")
        product_scrape_results = []
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            for id, product_search_result in zip(df['id'], executor.map(stealth_scraper.scrape_url, df['product_url'].to_list())):
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

        product_scrape_results_df = pd.DataFrame(product_scrape_results)
        
        # Print scraping summary
        print("\n=== Scraping Summary ===")
        print(product_scrape_results_df.value_counts(['success', 'status_code', 'final_method']))
        print("========================\n")
        
        product_scrape_results_df = df.merge(product_scrape_results_df, on='id', how='left') \
            .drop(columns=['product_url_y']) \
            .rename(columns={'product_url_x': 'product_url'})

        # STEP 2: Clean HTML and generate prompts
        logger.info("Processing HTML and generating prompts...")
        product_scrape_results_df_success = product_scrape_results_df[product_scrape_results_df['success'] == True]
        product_prompts_df = product_scrape_results_df.copy()

        for id, product_url, html_content in zip(
            product_scrape_results_df_success['id'], 
            product_scrape_results_df_success['product_url'], 
            product_scrape_results_df_success['html_content']
        ):
            try:
                # Record HTML processing start
                start_time = time.time()
                
                cleaned_html = html_processor.clean_html(str(html_content))
                cleaned_html_json = cleaned_html.model_dump_json()
                prompt = prompt_templator.product_extraction(product_url, cleaned_html_json)
                
                # Record processing time
                processing_time = time.time() - start_time
                monitor.record_metric(
                    name="html_processing.duration_seconds",
                    value=processing_time,
                    metric_type=MetricType.HISTOGRAM,
                    stage=PipelineStage.HTML_PROCESSING
                )
                
                # Add fields dynamically using loc
                product_prompts_df.loc[product_prompts_df['id'] == id, 'cleaned_html'] = cleaned_html_json
                product_prompts_df.loc[product_prompts_df['id'] == id, 'cleaned_html_len'] = len(cleaned_html_json)
                product_prompts_df.loc[product_prompts_df['id'] == id, 'prompt'] = prompt
                product_prompts_df.loc[product_prompts_df['id'] == id, 'prompt_len'] = len(prompt)
                
            except Exception as e:
                logger.error(f"Error processing HTML for URL {product_url}: {e}")
                monitor.record_error(
                    category=ErrorCategory.VALIDATION_ERROR,
                    stage=PipelineStage.HTML_PROCESSING,
                    url=product_url,
                    error_message=str(e)
                )

        # STEP 3: Invoke LLM
        logger.info(f"Starting LLM extraction with model {model_name}...")
        llm_results_df = product_prompts_df.copy()
        total_prompt_tokens = llm_results_df['prompt_len'].sum() // 4  # Rough estimate

        for id, success, prompt in zip(llm_results_df['id'], llm_results_df['success'], llm_results_df['prompt']):
            default_response = PromptTemplator.ProductExtractionOutput(
                    image_url="",
                    type="",
                    description="",
                    model_no="",
                    product_link="",
                    qty="",
                    key="",
                )

            if success == True and pd.notna(prompt):
                try:
                    start_time = time.time()
                    
                    llm_response = llm_invocator.invoke_llm(
                        model_provider="openai",
                        llm_model_name=model_name,
                        prompt=prompt
                    )
                    
                    # Calculate cost and record metrics
                    llm_time = time.time() - start_time
                    prompt_len = len(prompt) if prompt else 0
                    estimated_cost = estimate_llm_cost(model_name, prompt_len)
                    
                    # Get actual token usage if available
                    usage_stats = llm_invocator.get_usage_stats(model_name)
                    actual_tokens = usage_stats.get('tokens_used_minute', 0) if usage_stats else 0
                    
                    monitor.record_llm_result(
                        success=True,
                        model=model_name,
                        tokens_used=actual_tokens,
                        cost=estimated_cost
                    )
                    
                    # Validate response
                    default_response = PromptTemplator.ProductExtractionOutput.model_validate_json(llm_response)
                    
                except Exception as e:
                    error_msg = f"Error invoking LLM: {e}"
                    logger.error(error_msg)
                    default_response.description = error_msg
                    
                    monitor.record_llm_result(
                        success=False,
                        model=model_name,
                        error=str(e)
                    )

            llm_results_df.loc[llm_results_df['id'] == id, 'llm_response'] = default_response.model_dump_json()

        # STEP 4: Save results
        logger.info("Saving results...")
        print(f"\nProcessed {llm_results_df.count()['id']} URLs")
        llm_results_df.to_csv(f"{output_dir}/llm_results_monitored.csv", index=False)

        total_prompt_len = llm_results_df['prompt_len'].sum()
        print(f"Total prompt length: {total_prompt_len:,}")

        # Extract product specs
        llm_result_dicts = [dict(PromptTemplator.ProductExtractionOutput.model_validate_json(response)) 
                           for response in llm_results_df['llm_response'].to_list()]
        product_specs_df = pd.DataFrame(llm_result_dicts)
        product_specs_df.to_csv(f"{output_dir}/product_specs_monitored.csv", index=False)

        # End monitoring and print summary
        execution = monitor.end_execution()
        monitor.print_summary()
        
        # Generate and save metrics report
        if execution:
            from lib.monitoring import MetricsCollector
            collector = MetricsCollector()
            report = collector.generate_metrics_report([execution])
            
            report_path = f"{output_dir}/execution_report_{execution_id}.md"
            with open(report_path, 'w') as f:
                f.write(report)
            
            logger.info(f"Execution report saved to {report_path}")
        
    except Exception as e:
        logger.error(f"Pipeline failed with error: {e}")
        monitor.record_error(
            category=ErrorCategory.UNKNOWN_ERROR,
            stage=PipelineStage.VALIDATION,
            url="",
            error_message=str(e)
        )
        monitor.end_execution()
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run monitored specbook pipeline")
    parser.add_argument("--input", default="workspace/input/specbook.csv", 
                       help="Input CSV file with product URLs")
    parser.add_argument("--output-dir", default="workspace/output",
                       help="Output directory for results")
    parser.add_argument("--model", default="gpt-4o-mini",
                       choices=["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
                       help="OpenAI model to use")
    
    args = parser.parse_args()
    main(input_file=args.input, output_dir=args.output_dir, model_name=args.model)