"""Metrics collection and aggregation for pipeline monitoring"""
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import pandas as pd
from .models import PipelineMetric, PipelineExecution, MetricType


class MetricsCollector:
    """Collects and aggregates metrics from pipeline executions"""
    
    def __init__(self, metrics_dir: str = "data/metrics"):
        self.metrics_dir = Path(metrics_dir)
        self.metrics_dir.mkdir(exist_ok=True, parents=True)
        
    def aggregate_metrics(self, executions: List[PipelineExecution]) -> Dict[str, Any]:
        """Aggregate metrics across multiple executions"""
        if not executions:
            return {}
            
        # Collect all metrics
        all_metrics = []
        for execution in executions:
            for metric in execution.metrics:
                all_metrics.append({
                    "execution_id": execution.execution_id,
                    "name": metric.name,
                    "value": metric.value,
                    "type": metric.type.value,
                    "timestamp": metric.timestamp,
                    "stage": metric.stage.value if metric.stage else None,
                    **metric.labels
                })
        
        # Convert to DataFrame for easier aggregation
        df = pd.DataFrame(all_metrics)
        
        # Aggregate by metric name
        aggregations = {}
        
        for metric_name in df['name'].unique():
            metric_data = df[df['name'] == metric_name]
            metric_type = metric_data['type'].iloc[0]
            
            if metric_type == MetricType.COUNTER.value:
                # Sum counters
                aggregations[metric_name] = {
                    "type": "counter",
                    "total": metric_data['value'].sum(),
                    "count": len(metric_data),
                    "by_execution": metric_data.groupby('execution_id')['value'].sum().to_dict()
                }
            elif metric_type == MetricType.GAUGE.value:
                # Average gauges
                aggregations[metric_name] = {
                    "type": "gauge",
                    "mean": metric_data['value'].mean(),
                    "min": metric_data['value'].min(),
                    "max": metric_data['value'].max(),
                    "std": metric_data['value'].std(),
                    "count": len(metric_data)
                }
            elif metric_type == MetricType.HISTOGRAM.value:
                # Calculate percentiles for histograms
                aggregations[metric_name] = {
                    "type": "histogram",
                    "mean": metric_data['value'].mean(),
                    "p50": metric_data['value'].quantile(0.5),
                    "p95": metric_data['value'].quantile(0.95),
                    "p99": metric_data['value'].quantile(0.99),
                    "min": metric_data['value'].min(),
                    "max": metric_data['value'].max(),
                    "count": len(metric_data)
                }
        
        return aggregations
    
    def calculate_summary_stats(self, executions: List[PipelineExecution]) -> Dict[str, Any]:
        """Calculate summary statistics across executions"""
        if not executions:
            return {}
            
        # Overall stats
        total_urls = sum(e.total_urls for e in executions)
        total_scraped = sum(e.successful_scrapes + e.failed_scrapes for e in executions)
        total_successful = sum(e.successful_scrapes for e in executions)
        total_failed = sum(e.failed_scrapes for e in executions)
        
        # Error breakdown
        total_bot_detections = sum(e.bot_detections for e in executions)
        total_rate_limits = sum(e.rate_limit_errors for e in executions)
        total_network_errors = sum(e.network_errors for e in executions)
        
        # Cost breakdown
        total_cost = sum(e.total_cost for e in executions)
        total_openai_cost = sum(e.openai_cost for e in executions)
        total_firecrawl_cost = sum(e.firecrawl_cost for e in executions)
        
        # OpenAI call stats
        total_openai_calls = sum(e.successful_llm_calls + e.failed_llm_calls for e in executions)
        total_successful_llm = sum(e.successful_llm_calls for e in executions)
        total_failed_llm = sum(e.failed_llm_calls for e in executions)
        
        # Scraping method breakdown
        scrape_methods = defaultdict(int)
        error_by_method = defaultdict(lambda: defaultdict(int))
        
        # Analyze metrics to extract scraping method counts and errors
        for execution in executions:
            for metric in execution.metrics:
                if metric.name == "scrape.method" and "method" in metric.labels:
                    method = metric.labels["method"]
                    scrape_methods[method] += int(metric.value)
            
            # Analyze errors by scraping method
            for error in execution.errors:
                if "scraping_method" in error.additional_info:
                    method = error.additional_info["scraping_method"]
                    error_by_method[method][error.category.value] += 1
        
        # Calculate rates
        overall_success_rate = total_successful / total_scraped if total_scraped > 0 else 0
        llm_success_rate = total_successful_llm / total_openai_calls if total_openai_calls > 0 else 0
        
        # Duration stats
        durations = [e.duration for e in executions if e.duration]
        avg_duration = sum(durations) / len(durations) if durations else 0
        
        return {
            "executions": len(executions),
            "total_urls": total_urls,
            "total_scraped": total_scraped,
            "total_successful": total_successful,
            "total_failed": total_failed,
            "overall_success_rate": overall_success_rate,
            "scraping_methods": dict(scrape_methods),
            "openai_calls": {
                "total": total_openai_calls,
                "successful": total_successful_llm,
                "failed": total_failed_llm,
                "success_rate": llm_success_rate
            },
            "errors": {
                "bot_detections": total_bot_detections,
                "rate_limits": total_rate_limits,
                "network_errors": total_network_errors
            },
            "errors_by_method": dict(error_by_method),
            "cost": {
                "total": total_cost,
                "openai": total_openai_cost,
                "firecrawl": total_firecrawl_cost,
                "avg_per_url": total_cost / total_scraped if total_scraped > 0 else 0
            },
            "performance": {
                "avg_duration_seconds": avg_duration,
                "urls_per_second": total_scraped / sum(durations) if durations else 0
            }
        }
    
    def generate_metrics_report(self, executions: List[PipelineExecution]) -> str:
        """Generate a human-readable metrics report"""
        stats = self.calculate_summary_stats(executions)
        metrics = self.aggregate_metrics(executions)
        
        report = ["# Pipeline Metrics Report", ""]
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Summary
        report.append("## Summary Statistics")
        report.append(f"- Total Executions: {stats['executions']}")
        report.append(f"- Total URLs Processed: {stats['total_scraped']}/{stats['total_urls']}")
        report.append(f"- Overall Success Rate: {stats['overall_success_rate']:.2%}")
        report.append(f"- Average Duration: {stats['performance']['avg_duration_seconds']:.2f}s")
        report.append(f"- Processing Speed: {stats['performance']['urls_per_second']:.2f} URLs/second")
        report.append("")
        
        # Scraping Method Breakdown
        report.append("## Scraping Method Breakdown")
        if stats['scraping_methods']:
            for method, count in stats['scraping_methods'].items():
                if method == "requests":
                    report.append(f"- Requests Library: {count}")
                elif method == "firecrawl":
                    report.append(f"- Firecrawl API: {count}")
                elif method == "cached":
                    report.append(f"- Cached Content: {count}")
                else:
                    report.append(f"- {method.title()}: {count}")
        else:
            report.append("- No scraping method data available")
        report.append("")
        
        # OpenAI API Calls
        report.append("## OpenAI API Usage")
        report.append(f"- Total API Calls: {stats['openai_calls']['total']}")
        report.append(f"- Successful Calls: {stats['openai_calls']['successful']}")
        report.append(f"- Failed Calls: {stats['openai_calls']['failed']}")
        report.append(f"- Success Rate: {stats['openai_calls']['success_rate']:.2%}")
        report.append("")
        
        # Error Breakdown
        report.append("## Error Breakdown")
        report.append(f"- Bot Detections: {stats['errors']['bot_detections']}")
        report.append(f"- Rate Limit Errors: {stats['errors']['rate_limits']}")
        report.append(f"- Network Errors: {stats['errors']['network_errors']}")
        report.append("")
        
        # Error Breakdown by Scraping Method
        if stats['errors_by_method']:
            report.append("## Errors by Scraping Method")
            for method, errors in stats['errors_by_method'].items():
                method_name = "Requests Library" if method == "requests" else "Firecrawl API" if method == "firecrawl" else method.title()
                report.append(f"### {method_name}")
                total_errors = sum(errors.values())
                report.append(f"- Total Errors: {total_errors}")
                for error_type, count in errors.items():
                    error_name = error_type.replace('_', ' ').title()
                    report.append(f"- {error_name}: {count}")
                report.append("")
        
        # Cost Analysis
        report.append("## Cost Analysis")
        report.append(f"- Total Cost: ${stats['cost']['total']:.4f}")
        report.append(f"- OpenAI Cost: ${stats['cost']['openai']:.4f}")
        report.append(f"- Firecrawl Cost: ${stats['cost']['firecrawl']:.4f}")
        report.append(f"- Average Cost per URL: ${stats['cost']['avg_per_url']:.4f}")
        report.append("")
        
        # Key Metrics
        report.append("## Key Metrics")
        for metric_name, data in sorted(metrics.items()):
            if data['type'] == 'counter':
                report.append(f"- {metric_name}: {data['total']} total")
            elif data['type'] == 'gauge':
                report.append(f"- {metric_name}: {data['mean']:.2f} avg (min: {data['min']:.2f}, max: {data['max']:.2f})")
            elif data['type'] == 'histogram':
                report.append(f"- {metric_name}: p50={data['p50']:.2f}, p95={data['p95']:.2f}, p99={data['p99']:.2f}")
        
        return "\n".join(report)
    
    def save_aggregated_metrics(self, executions: List[PipelineExecution], filename: str = "aggregated_metrics.json"):
        """Save aggregated metrics to file"""
        stats = self.calculate_summary_stats(executions)
        metrics = self.aggregate_metrics(executions)
        
        data = {
            "generated_at": datetime.now().isoformat(),
            "summary": stats,
            "metrics": metrics
        }
        
        filepath = self.metrics_dir / filename
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        return filepath
    
    def load_all_executions(self) -> List[PipelineExecution]:
        """Load all execution records from metrics directory"""
        executions = []
        
        for file in self.metrics_dir.glob("exec_*.json"):
            try:
                with open(file, 'r') as f:
                    data = json.load(f)
                execution = PipelineExecution.model_validate(data)
                executions.append(execution)
            except Exception as e:
                print(f"Error loading {file}: {e}")
                
        return sorted(executions, key=lambda e: e.start_time)
    
    def get_metrics_by_stage(self, executions: List[PipelineExecution]) -> Dict[str, Dict[str, Any]]:
        """Group metrics by pipeline stage"""
        stage_metrics = defaultdict(list)
        
        for execution in executions:
            for metric in execution.metrics:
                if metric.stage:
                    stage_metrics[metric.stage.value].append(metric)
        
        # Aggregate by stage
        result = {}
        for stage, metrics in stage_metrics.items():
            # Count metrics by name
            metric_counts = defaultdict(float)
            for metric in metrics:
                if metric.type == MetricType.COUNTER:
                    metric_counts[metric.name] += metric.value
                    
            result[stage] = dict(metric_counts)
            
        return result