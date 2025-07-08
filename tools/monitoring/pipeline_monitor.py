"""Pipeline monitoring system for tracking execution and collecting metrics"""
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from ..stealth_scraper import ScrapeResult, PageIssue
from .models import (
    PipelineExecution, PipelineMetric, PipelineError, 
    PipelineStage, MetricType, ErrorCategory
)

logger = logging.getLogger(__name__)


class PipelineMonitor:
    """Monitors pipeline execution and collects metrics"""
    
    def __init__(self, metrics_dir: str = "data/metrics"):
        self.metrics_dir = Path(metrics_dir)
        self.metrics_dir.mkdir(exist_ok=True, parents=True)
        self.current_execution: Optional[PipelineExecution] = None
        self.executions: List[PipelineExecution] = []
        
    def start_execution(self, total_urls: int) -> str:
        """Start a new pipeline execution"""
        execution_id = f"exec_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.current_execution = PipelineExecution(
            execution_id=execution_id,
            start_time=datetime.now(),
            total_urls=total_urls
        )
        logger.info(f"Started pipeline execution {execution_id} for {total_urls} URLs")
        
        # Record start metric
        self.record_metric(
            name="pipeline.started",
            value=1,
            metric_type=MetricType.COUNTER,
            labels={"execution_id": execution_id}
        )
        
        return execution_id
    
    def end_execution(self) -> Optional[PipelineExecution]:
        """End the current execution and save metrics"""
        if not self.current_execution:
            logger.warning("No active execution to end")
            return None
            
        self.current_execution.end_time = datetime.now()
        
        # Record summary metrics
        self.record_metric(
            name="pipeline.completed",
            value=1,
            metric_type=MetricType.COUNTER,
            labels={"execution_id": self.current_execution.execution_id}
        )
        
        self.record_metric(
            name="pipeline.duration_seconds",
            value=self.current_execution.duration or 0,
            metric_type=MetricType.GAUGE,
            labels={"execution_id": self.current_execution.execution_id}
        )
        
        self.record_metric(
            name="pipeline.success_rate",
            value=self.current_execution.success_rate,
            metric_type=MetricType.GAUGE,
            labels={"execution_id": self.current_execution.execution_id}
        )
        
        # Save execution to file
        self._save_execution(self.current_execution)
        
        # Add to executions list
        self.executions.append(self.current_execution)
        
        logger.info(
            f"Completed pipeline execution {self.current_execution.execution_id} "
            f"in {self.current_execution.duration:.2f}s "
            f"with {self.current_execution.success_rate:.2%} success rate"
        )
        
        completed_execution = self.current_execution
        self.current_execution = None
        return completed_execution
    
    def record_scrape_result(self, result: ScrapeResult, stage: PipelineStage = PipelineStage.SCRAPING):
        """Record metrics from a scrape result"""
        if not self.current_execution:
            logger.warning("No active execution - cannot record scrape result")
            return
            
        # Update counters
        if result.success:
            self.current_execution.successful_scrapes += 1
            self.record_metric(
                name="scrape.success",
                value=1,
                metric_type=MetricType.COUNTER,
                stage=stage,
                labels={
                    "method": result.final_method.value,
                    "status_code": str(result.status_code or "none")
                }
            )
        else:
            self.current_execution.failed_scrapes += 1
            self.record_metric(
                name="scrape.failure",
                value=1,
                metric_type=MetricType.COUNTER,
                stage=stage,
                labels={
                    "method": result.final_method.value,
                    "error_reason": result.error_reason or "unknown"
                }
            )
            
            # Categorize and record error
            error_category = self._categorize_scrape_error(result)
            self.record_error(
                category=error_category,
                stage=stage,
                url=result.url,
                error_message=result.error_reason or "Unknown error"
            )
            
            # Update specific error counters
            if PageIssue.BOT_DETECTED in result.page_issues:
                self.current_execution.bot_detections += 1
            if PageIssue.TIMEOUT in result.page_issues:
                self.current_execution.network_errors += 1
                
        # Record scrape time
        if result.scrape_time > 0:
            self.record_metric(
                name="scrape.duration_seconds",
                value=result.scrape_time,
                metric_type=MetricType.HISTOGRAM,
                stage=stage,
                labels={"method": result.final_method.value}
            )
    
    def record_llm_result(self, success: bool, model: str, error: Optional[str] = None, 
                         tokens_used: int = 0, cost: float = 0.0):
        """Record metrics from LLM invocation"""
        if not self.current_execution:
            logger.warning("No active execution - cannot record LLM result")
            return
            
        stage = PipelineStage.LLM_EXTRACTION
        
        if success:
            self.current_execution.successful_llm_calls += 1
            self.record_metric(
                name="llm.success",
                value=1,
                metric_type=MetricType.COUNTER,
                stage=stage,
                labels={"model": model}
            )
        else:
            self.current_execution.failed_llm_calls += 1
            self.record_metric(
                name="llm.failure",
                value=1,
                metric_type=MetricType.COUNTER,
                stage=stage,
                labels={"model": model, "error": error or "unknown"}
            )
            
            # Categorize error
            if error and "rate" in error.lower():
                self.current_execution.rate_limit_errors += 1
                error_category = ErrorCategory.RATE_LIMIT
            else:
                error_category = ErrorCategory.LLM_ERROR
                
            self.record_error(
                category=error_category,
                stage=stage,
                url="",  # URL not available here
                error_message=error or "Unknown LLM error"
            )
        
        # Record token usage and cost
        if tokens_used > 0:
            self.record_metric(
                name="llm.tokens_used",
                value=tokens_used,
                metric_type=MetricType.COUNTER,
                stage=stage,
                labels={"model": model}
            )
            
        if cost > 0:
            self.current_execution.openai_cost += cost
            self.current_execution.total_cost += cost
            self.record_metric(
                name="llm.cost_usd",
                value=cost,
                metric_type=MetricType.COUNTER,
                stage=stage,
                labels={"model": model}
            )
    
    def record_metric(self, name: str, value: float, metric_type: MetricType,
                     stage: Optional[PipelineStage] = None, labels: Optional[Dict[str, str]] = None):
        """Record a generic metric"""
        if not self.current_execution:
            return
            
        metric = PipelineMetric(
            name=name,
            value=value,
            type=metric_type,
            stage=stage,
            labels=labels or {}
        )
        self.current_execution.metrics.append(metric)
        
        # Log important metrics
        if metric_type == MetricType.COUNTER or name.endswith("_rate"):
            logger.debug(f"Metric: {name}={value} {labels or {}}")
    
    def record_error(self, category: ErrorCategory, stage: PipelineStage, 
                    url: str, error_message: str, additional_info: Optional[Dict[str, str]] = None):
        """Record an error that occurred during execution"""
        if not self.current_execution:
            return
            
        error = PipelineError(
            category=category,
            stage=stage,
            url=url,
            error_message=error_message,
            additional_info=additional_info or {}
        )
        self.current_execution.errors.append(error)
        
        logger.error(f"Pipeline error: {category.value} at {stage.value} - {error_message}")
    
    def get_current_stats(self) -> Optional[Dict[str, Any]]:
        """Get current execution statistics"""
        if not self.current_execution:
            return None
            
        return {
            "execution_id": self.current_execution.execution_id,
            "start_time": self.current_execution.start_time.isoformat(),
            "total_urls": self.current_execution.total_urls,
            "progress": {
                "scraped": self.current_execution.successful_scrapes + self.current_execution.failed_scrapes,
                "successful": self.current_execution.successful_scrapes,
                "failed": self.current_execution.failed_scrapes
            },
            "errors": {
                "bot_detections": self.current_execution.bot_detections,
                "rate_limits": self.current_execution.rate_limit_errors,
                "network": self.current_execution.network_errors,
                "validation": self.current_execution.validation_errors
            },
            "cost": {
                "total": self.current_execution.total_cost,
                "openai": self.current_execution.openai_cost,
                "firecrawl": self.current_execution.firecrawl_cost
            }
        }
    
    def print_summary(self):
        """Print a summary of the current execution"""
        if not self.current_execution:
            print("No active execution")
            return
            
        stats = self.get_current_stats()
        if not stats:
            return
            
        print("\n=== Pipeline Execution Summary ===")
        print(f"Execution ID: {stats['execution_id']}")
        print(f"Started: {stats['start_time']}")
        print(f"\nProgress: {stats['progress']['scraped']}/{stats['total_urls']} URLs processed")
        print(f"  Successful: {stats['progress']['successful']}")
        print(f"  Failed: {stats['progress']['failed']}")
        print(f"\nErrors:")
        print(f"  Bot Detections: {stats['errors']['bot_detections']}")
        print(f"  Rate Limits: {stats['errors']['rate_limits']}")
        print(f"  Network Errors: {stats['errors']['network']}")
        print(f"  Validation Errors: {stats['errors']['validation']}")
        print(f"\nCost:")
        print(f"  Total: ${stats['cost']['total']:.4f}")
        print(f"  OpenAI: ${stats['cost']['openai']:.4f}")
        print(f"  Firecrawl: ${stats['cost']['firecrawl']:.4f}")
        print("================================\n")
    
    def _categorize_scrape_error(self, result: ScrapeResult) -> ErrorCategory:
        """Categorize scraping error based on result"""
        if PageIssue.BOT_DETECTED in result.page_issues:
            return ErrorCategory.BOT_DETECTION
        elif PageIssue.CAPTCHA_PRESENT in result.page_issues:
            return ErrorCategory.BOT_DETECTION
        elif PageIssue.TIMEOUT in result.page_issues:
            return ErrorCategory.NETWORK_ERROR
        elif result.error_reason and "rate" in result.error_reason.lower():
            return ErrorCategory.RATE_LIMIT
        elif result.error_reason and "firecrawl" in result.error_reason.lower():
            return ErrorCategory.FIRECRAWL_ERROR
        else:
            return ErrorCategory.UNKNOWN_ERROR
    
    def _save_execution(self, execution: PipelineExecution):
        """Save execution data to file"""
        filename = self.metrics_dir / f"{execution.execution_id}.json"
        with open(filename, 'w') as f:
            json.dump(execution.model_dump(mode='json'), f, indent=2, default=str)
        logger.info(f"Saved execution metrics to {filename}")
    
    def load_execution(self, execution_id: str) -> Optional[PipelineExecution]:
        """Load a previous execution from file"""
        filename = self.metrics_dir / f"{execution_id}.json"
        if not filename.exists():
            return None
            
        with open(filename, 'r') as f:
            data = json.load(f)
        return PipelineExecution.model_validate(data)