"""Experiment runner for benchmarking different LLM models and prompts"""
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..core.html_processor import HTMLProcessor
from ..core.llm import PromptTemplator, LLMInvocator
from ..core.scraping import StealthScraper
from ..core.evaluation import ProductExtractionEvaluator
from ..monitoring.pipeline_monitor import PipelineMonitor
from ..monitoring.models import PipelineStage

from .cache_manager import CacheManager
from .models import (
    ExperimentConfig, ExperimentResult, ExperimentSummary,
    QualityMetrics, ModelProvider
)

logger = logging.getLogger(__name__)


class ExperimentRunner:
    """Runs experiments to compare different models and prompts"""
    
    def __init__(self, cache_manager: Optional[CacheManager] = None, 
                 monitor: Optional[PipelineMonitor] = None):
        self.cache_manager = cache_manager or CacheManager()
        self.monitor = monitor or PipelineMonitor()
        self.llm_invocator = LLMInvocator()
        self.html_processor = HTMLProcessor()
        self.prompt_templator = PromptTemplator()
        self.scraper = StealthScraper()
        self.evaluator = ProductExtractionEvaluator()
        
        # Model pricing (per 1K tokens)
        self.model_pricing = {
            "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
            "gpt-4o": {"input": 0.005, "output": 0.015},
            "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015}
        }
    
    def run_experiment(self, config: ExperimentConfig, urls: List[str], 
                      use_cache: bool = True, max_workers: int = 5) -> ExperimentSummary:
        """Run a single experiment with given configuration"""
        logger.info(f"Starting experiment {config.experiment_id} with model {config.model_name}")
        
        # Import cached data if requested
        if use_cache:
            imported = self.cache_manager.import_from_llm_results()
            logger.info(f"Imported {imported} HTML documents from previous runs")
        
        # Start monitoring
        execution_id = self.monitor.start_execution(total_urls=len(urls))
        
        # Track experiment metrics
        results: List[ExperimentResult] = []
        started_at = datetime.now()
        
        # Process URLs in parallel
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_url = {
                executor.submit(self._process_single_url, url, config, use_cache): url 
                for url in urls
            }
            
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    result = future.result()
                    results.append(result)
                    
                    # Log progress
                    if len(results) % 10 == 0:
                        logger.info(f"Processed {len(results)}/{len(urls)} URLs")
                        
                except Exception as e:
                    logger.error(f"Error processing {url}: {e}")
                    # Create failed result
                    results.append(self._create_failed_result(url, config, str(e)))
        
        completed_at = datetime.now()
        
        # End monitoring
        self.monitor.end_execution()
        
        # Calculate summary statistics
        summary = self._create_experiment_summary(
            config, results, started_at, completed_at
        )
        
        # Save results
        self._save_experiment_results(summary)
        
        logger.info(
            f"Completed experiment {config.experiment_id}: "
            f"{summary.successful_extractions}/{summary.total_urls} successful, "
            f"avg quality: {summary.avg_quality_score:.3f}, "
            f"total cost: ${summary.total_cost:.4f}"
        )
        
        return summary
    
    def run_model_comparison(self, urls: List[str], models: List[str], 
                           prompt_template: str = "default",
                           use_cache: bool = True) -> Dict[str, ExperimentSummary]:
        """Run experiments comparing multiple models"""
        summaries = {}
        
        for model_name in models:
            config = ExperimentConfig(
                experiment_id=f"compare_{model_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                model_name=model_name,
                prompt_template=prompt_template
            )
            
            summary = self.run_experiment(config, urls, use_cache)
            summaries[model_name] = summary
            
        return summaries
    
    def _process_single_url(self, url: str, config: ExperimentConfig, 
                          use_cache: bool) -> ExperimentResult:
        """Process a single URL for benchmarking"""
        start_time = time.time()
        
        try:
            # Step 1: Get HTML (from cache or scrape)
            html_content = None
            if use_cache:
                html_content = self.cache_manager.get_cached_html(url)
                
            if not html_content:
                logger.debug(f"Scraping {url} (not in cache)")
                scrape_result = self.scraper.scrape_url(url)
                
                if scrape_result.success and scrape_result.content:
                    html_content = scrape_result.content
                    # Cache for future use
                    self.cache_manager.store_html(url, html_content, {
                        'scrape_method': scrape_result.final_method.value,
                        'status_code': scrape_result.status_code
                    })
                else:
                    raise Exception(f"Failed to scrape: {scrape_result.error_reason}")
            
            # Step 2: Process HTML and generate prompt
            cleaned_html = self.html_processor.clean_html(html_content)
            prompt = self.prompt_templator.product_extraction(
                url, cleaned_html.model_dump_json()
            )
            
            # Step 3: Call LLM
            llm_start = time.time()
            raw_response = self.llm_invocator.invoke_llm(
                model_provider="openai",
                llm_model_name=config.model_name,
                prompt=prompt,
                temperature=config.temperature,
                max_tokens=config.max_tokens
            )
            llm_time = time.time() - llm_start
            
            # Step 4: Parse and validate response
            try:
                extracted_data = PromptTemplator.ProductExtractionOutput.model_validate_json(raw_response)
                extraction_successful = True
                extracted_dict = extracted_data.model_dump()
            except Exception as e:
                logger.warning(f"Failed to parse LLM response: {e}")
                extraction_successful = False
                extracted_dict = {"error": str(e)}
            
            # Step 5: Evaluate quality
            eval_result = self.evaluator.evaluate_extraction(raw_response, url)
            quality_metrics = QualityMetrics(
                overall_score=eval_result.overall_score,
                field_scores=eval_result.field_quality_scores,
                json_parseable=eval_result.json_parseable,
                required_fields_present=eval_result.required_fields_present,
                url_valid=eval_result.url_valid,
                issues=eval_result.issues
            )
            
            # Step 6: Calculate costs
            prompt_tokens = len(prompt) // 4  # Rough estimate
            completion_tokens = len(raw_response) // 4
            total_tokens = prompt_tokens + completion_tokens
            cost = self._calculate_cost(config.model_name, prompt_tokens, completion_tokens)
            
            # Record metrics
            self.monitor.record_llm_result(
                success=extraction_successful,
                model=config.model_name,
                tokens_used=total_tokens,
                cost=cost
            )
            
            execution_time = time.time() - start_time
            
            return ExperimentResult(
                config=config,
                url=url,
                execution_time=execution_time,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=cost,
                quality_metrics=quality_metrics,
                extraction_successful=extraction_successful,
                prompt=prompt,
                raw_response=raw_response,
                extracted_data=extracted_dict
            )
            
        except Exception as e:
            logger.error(f"Error processing {url}: {e}")
            return self._create_failed_result(url, config, str(e))
    
    def _calculate_cost(self, model_name: str, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost based on model and token usage"""
        if model_name not in self.model_pricing:
            logger.warning(f"Unknown model {model_name}, cannot calculate cost")
            return 0.0
            
        pricing = self.model_pricing[model_name]
        input_cost = (input_tokens / 1000) * pricing["input"]
        output_cost = (output_tokens / 1000) * pricing["output"]
        
        return input_cost + output_cost
    
    def _create_failed_result(self, url: str, config: ExperimentConfig, 
                            error_message: str) -> ExperimentResult:
        """Create a result object for failed processing"""
        return ExperimentResult(
            config=config,
            url=url,
            execution_time=0.0,
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            cost_usd=0.0,
            quality_metrics=QualityMetrics(
                overall_score=0.0,
                field_scores={},
                json_parseable=False,
                required_fields_present=False,
                url_valid=False,
                issues=[error_message]
            ),
            extraction_successful=False,
            prompt="",
            raw_response="",
            extracted_data={},
            error_message=error_message
        )
    
    def _create_experiment_summary(self, config: ExperimentConfig, 
                                 results: List[ExperimentResult],
                                 started_at: datetime, 
                                 completed_at: datetime) -> ExperimentSummary:
        """Create summary from experiment results"""
        successful = [r for r in results if r.extraction_successful]
        failed = [r for r in results if not r.extraction_successful]
        
        # Calculate aggregates
        total_cost = sum(r.cost_usd for r in results)
        total_tokens = sum(r.total_tokens for r in results)
        avg_execution_time = sum(r.execution_time for r in results) / len(results) if results else 0
        
        # Quality metrics
        quality_scores = [r.quality_metrics.overall_score for r in successful]
        avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
        
        # Quality distribution
        score_distribution = {
            "0.0-0.2": 0,
            "0.2-0.4": 0,
            "0.4-0.6": 0,
            "0.6-0.8": 0,
            "0.8-1.0": 0
        }
        
        for score in quality_scores:
            if score <= 0.2:
                score_distribution["0.0-0.2"] += 1
            elif score <= 0.4:
                score_distribution["0.2-0.4"] += 1
            elif score <= 0.6:
                score_distribution["0.4-0.6"] += 1
            elif score <= 0.8:
                score_distribution["0.6-0.8"] += 1
            else:
                score_distribution["0.8-1.0"] += 1
        
        # Common issues
        all_issues = []
        for r in results:
            all_issues.extend(r.quality_metrics.issues)
        
        issue_counts = {}
        for issue in all_issues:
            issue_counts[issue] = issue_counts.get(issue, 0) + 1
        
        # Performance metrics
        duration_seconds = (completed_at - started_at).total_seconds()
        tokens_per_second = total_tokens / duration_seconds if duration_seconds > 0 else 0
        
        return ExperimentSummary(
            config=config,
            total_urls=len(results),
            successful_extractions=len(successful),
            failed_extractions=len(failed),
            total_cost=total_cost,
            total_tokens=total_tokens,
            avg_execution_time=avg_execution_time,
            success_rate=len(successful) / len(results) if results else 0,
            avg_quality_score=avg_quality,
            quality_score_distribution=score_distribution,
            common_issues=issue_counts,
            tokens_per_second=tokens_per_second,
            cost_per_url=total_cost / len(results) if results else 0,
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=duration_seconds,
            results=results
        )
    
    def _save_experiment_results(self, summary: ExperimentSummary):
        """Save experiment results to disk"""
        output_dir = Path("data/benchmarks")
        output_dir.mkdir(exist_ok=True, parents=True)
        
        # Save summary
        summary_file = output_dir / f"{summary.config.experiment_id}_summary.json"
        with open(summary_file, 'w') as f:
            # Convert to dict and handle datetime serialization
            summary_dict = summary.model_dump(mode='json')
            json.dump(summary_dict, f, indent=2, default=str)
        
        # Save detailed results as CSV
        results_data = []
        for r in summary.results:
            results_data.append({
                'url': r.url,
                'success': r.extraction_successful,
                'quality_score': r.quality_metrics.overall_score,
                'execution_time': r.execution_time,
                'tokens': r.total_tokens,
                'cost': r.cost_usd,
                'error': r.error_message or '',
                'issues': ', '.join(r.quality_metrics.issues)
            })
        
        if results_data:
            results_df = pd.DataFrame(results_data)
            results_file = output_dir / f"{summary.config.experiment_id}_results.csv"
            results_df.to_csv(results_file, index=False)
            
        logger.info(f"Saved experiment results to {summary_file}")