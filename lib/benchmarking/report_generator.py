"""Report generator for benchmarking results with charts and comparisons"""
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import pandas as pd

# Optional matplotlib imports for chart generation
try:
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.gridspec import GridSpec
    import seaborn as sns
    
    # Set matplotlib style
    plt.style.use('seaborn-v0_8-darkgrid')
    sns.set_palette("husl")
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    plt = None
    sns = None

from .models import ExperimentSummary, BenchmarkComparison


class ReportGenerator:
    """Generates comprehensive reports from benchmarking experiments"""
    
    def __init__(self, output_dir: str = "workspace/output/benchmarks/reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)
    
    def generate_comparison_report(self, summaries: Dict[str, ExperimentSummary], 
                                 report_name: str = None) -> str:
        """Generate a comprehensive comparison report"""
        if not summaries:
            return "No experiment summaries provided"
        
        # Generate report name if not provided
        if not report_name:
            report_name = f"benchmark_comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Create comparison object
        comparison = self._create_benchmark_comparison(summaries)
        
        # Generate markdown report
        markdown_report = self._generate_markdown_report(comparison, summaries)
        
        # Generate charts if matplotlib is available
        if MATPLOTLIB_AVAILABLE:
            charts_dir = self.output_dir / f"{report_name}_charts"
            charts_dir.mkdir(exist_ok=True)
            self._generate_charts(comparison, summaries, charts_dir)
        else:
            print("Warning: Matplotlib not available, skipping chart generation")
        
        # Save reports
        markdown_path = self.output_dir / f"{report_name}.md"
        with open(markdown_path, 'w') as f:
            f.write(markdown_report)
        
        # Save raw data
        data_path = self.output_dir / f"{report_name}_data.json"
        with open(data_path, 'w') as f:
            comparison_dict = comparison.model_dump(mode='json')
            json.dump(comparison_dict, f, indent=2, default=str)
        
        # Generate executive summary
        exec_summary = self._generate_executive_summary(comparison, summaries)
        exec_path = self.output_dir / f"{report_name}_executive_summary.md"
        with open(exec_path, 'w') as f:
            f.write(exec_summary)
        
        print(f"Reports generated in {self.output_dir}")
        print(f"- Full report: {markdown_path}")
        print(f"- Executive summary: {exec_path}")
        print(f"- Charts: {charts_dir}/")
        
        return str(markdown_path)
    
    def _create_benchmark_comparison(self, summaries: Dict[str, ExperimentSummary]) -> BenchmarkComparison:
        """Create a benchmark comparison object"""
        # Extract summaries list
        experiment_summaries = list(summaries.values())
        
        # Calculate comparison metrics
        comparison_metrics = {}
        quality_comparison = {}
        cost_comparison = {}
        speed_comparison = {}
        quality_variance = {}
        
        for model_name, summary in summaries.items():
            comparison_metrics[model_name] = {
                "success_rate": summary.success_rate,
                "avg_quality": summary.avg_quality_score,
                "total_cost": summary.total_cost,
                "cost_per_url": summary.cost_per_url,
                "avg_execution_time": summary.avg_execution_time,
                "tokens_per_second": summary.tokens_per_second
            }
            
            quality_comparison[model_name] = summary.avg_quality_score
            cost_comparison[model_name] = summary.total_cost
            speed_comparison[model_name] = summary.avg_execution_time
            
            # Calculate variance in quality scores
            quality_scores = [r.quality_metrics.overall_score for r in summary.results 
                            if r.extraction_successful]
            if quality_scores:
                variance = pd.Series(quality_scores).var()
                quality_variance[model_name] = variance
        
        # Determine winners
        best_quality_model = max(quality_comparison.items(), key=lambda x: x[1])[0]
        best_cost_model = min(cost_comparison.items(), key=lambda x: x[1])[0]
        best_speed_model = min(speed_comparison.items(), key=lambda x: x[1])[0]
        
        # Recommend model based on balanced criteria
        scores = {}
        for model in summaries.keys():
            # Normalize scores (0-1 range)
            quality_score = quality_comparison[model]
            cost_score = 1 - (cost_comparison[model] / max(cost_comparison.values()))
            speed_score = 1 - (speed_comparison[model] / max(speed_comparison.values()))
            
            # Weighted average (quality is most important)
            scores[model] = (quality_score * 0.5) + (cost_score * 0.3) + (speed_score * 0.2)
        
        recommended_model = max(scores.items(), key=lambda x: x[1])[0]
        
        # Generate recommendation reason
        if recommended_model == best_quality_model:
            reason = "Highest quality results with good cost-performance balance"
        elif recommended_model == best_cost_model:
            reason = "Most cost-effective with acceptable quality"
        else:
            reason = "Best overall balance of quality, cost, and speed"
        
        # Check for significant differences
        significant_differences = []
        quality_values = list(quality_comparison.values())
        if max(quality_values) - min(quality_values) > 0.1:
            significant_differences.append("Significant quality differences between models")
        
        cost_values = list(cost_comparison.values())
        if max(cost_values) / min(cost_values) > 2:
            significant_differences.append("Cost varies by more than 2x between models")
        
        return BenchmarkComparison(
            experiment_summaries=experiment_summaries,
            comparison_metrics=comparison_metrics,
            best_quality_model=best_quality_model,
            best_cost_model=best_cost_model,
            best_speed_model=best_speed_model,
            recommended_model=recommended_model,
            recommendation_reason=reason,
            quality_comparison=quality_comparison,
            cost_comparison=cost_comparison,
            speed_comparison=speed_comparison,
            quality_variance=quality_variance,
            significant_differences=significant_differences
        )
    
    def _generate_markdown_report(self, comparison: BenchmarkComparison, 
                                summaries: Dict[str, ExperimentSummary]) -> str:
        """Generate detailed markdown report"""
        report = ["# LLM Model Benchmarking Report", ""]
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Executive Summary
        report.append("## Executive Summary")
        report.append(f"- **Recommended Model**: {comparison.recommended_model}")
        report.append(f"- **Reason**: {comparison.recommendation_reason}")
        report.append(f"- **Best Quality**: {comparison.best_quality_model} "
                     f"({comparison.quality_comparison[comparison.best_quality_model]:.3f})")
        report.append(f"- **Most Cost-Effective**: {comparison.best_cost_model} "
                     f"(${comparison.cost_comparison[comparison.best_cost_model]:.4f})")
        report.append(f"- **Fastest**: {comparison.best_speed_model} "
                     f"({comparison.speed_comparison[comparison.best_speed_model]:.2f}s avg)")
        report.append("")
        
        # Test Configuration
        report.append("## Test Configuration")
        first_summary = list(summaries.values())[0]
        report.append(f"- **Total URLs Tested**: {first_summary.total_urls}")
        report.append(f"- **Models Compared**: {', '.join(summaries.keys())}")
        report.append(f"- **Prompt Template**: {first_summary.config.prompt_template}")
        report.append("")
        
        # Detailed Comparison Table
        report.append("## Detailed Comparison")
        report.append("")
        report.append("| Model | Success Rate | Avg Quality | Total Cost | Cost/URL | Avg Time | Tokens/sec |")
        report.append("|-------|-------------|-------------|------------|----------|----------|------------|")
        
        for model, metrics in comparison.comparison_metrics.items():
            report.append(
                f"| {model} | "
                f"{metrics['success_rate']:.1%} | "
                f"{metrics['avg_quality']:.3f} | "
                f"${metrics['total_cost']:.4f} | "
                f"${metrics['cost_per_url']:.4f} | "
                f"{metrics['avg_execution_time']:.2f}s | "
                f"{metrics['tokens_per_second']:.0f} |"
            )
        report.append("")
        
        # Quality Analysis
        report.append("## Quality Analysis")
        report.append("")
        for model, summary in summaries.items():
            report.append(f"### {model}")
            report.append(f"- Average Quality Score: {summary.avg_quality_score:.3f}")
            report.append("- Score Distribution:")
            for range_key, count in summary.quality_score_distribution.items():
                percentage = (count / summary.successful_extractions * 100) if summary.successful_extractions > 0 else 0
                report.append(f"  - {range_key}: {count} ({percentage:.1f}%)")
            report.append("")
        
        # Common Issues
        report.append("## Common Issues by Model")
        report.append("")
        for model, summary in summaries.items():
            if summary.common_issues:
                report.append(f"### {model}")
                top_issues = sorted(summary.common_issues.items(), 
                                  key=lambda x: x[1], reverse=True)[:5]
                for issue, count in top_issues:
                    report.append(f"- {issue}: {count} occurrences")
                report.append("")
        
        # Cost Breakdown
        report.append("## Cost Analysis")
        report.append("")
        report.append("| Model | Total Cost | Per URL | Per 1K Tokens |")
        report.append("|-------|-----------|---------|---------------|")
        
        for model, summary in summaries.items():
            cost_per_1k = (summary.total_cost / summary.total_tokens * 1000) if summary.total_tokens > 0 else 0
            report.append(
                f"| {model} | "
                f"${summary.total_cost:.4f} | "
                f"${summary.cost_per_url:.4f} | "
                f"${cost_per_1k:.4f} |"
            )
        report.append("")
        
        # Performance Metrics
        report.append("## Performance Metrics")
        report.append("")
        for model, summary in summaries.items():
            report.append(f"### {model}")
            report.append(f"- Total Duration: {summary.duration_seconds:.2f}s")
            report.append(f"- Average per URL: {summary.avg_execution_time:.2f}s")
            report.append(f"- Tokens per Second: {summary.tokens_per_second:.0f}")
            report.append(f"- Total Tokens Used: {summary.total_tokens:,}")
            report.append("")
        
        # Significant Findings
        if comparison.significant_differences:
            report.append("## Significant Findings")
            for finding in comparison.significant_differences:
                report.append(f"- {finding}")
            report.append("")
        
        # Recommendations
        report.append("## Recommendations")
        report.append("")
        report.append(f"**Use {comparison.recommended_model} for production** - {comparison.recommendation_reason}")
        report.append("")
        report.append("### Model Selection Guide:")
        report.append(f"- **For highest quality**: Use {comparison.best_quality_model}")
        report.append(f"- **For lowest cost**: Use {comparison.best_cost_model}")
        report.append(f"- **For fastest processing**: Use {comparison.best_speed_model}")
        report.append("")
        
        # Quality variance analysis
        if comparison.quality_variance:
            report.append("### Quality Consistency:")
            for model, variance in sorted(comparison.quality_variance.items(), key=lambda x: x[1]):
                consistency = "High" if variance < 0.01 else "Medium" if variance < 0.05 else "Low"
                report.append(f"- {model}: {consistency} consistency (variance: {variance:.4f})")
        
        return "\n".join(report)
    
    def _generate_executive_summary(self, comparison: BenchmarkComparison,
                                  summaries: Dict[str, ExperimentSummary]) -> str:
        """Generate a concise executive summary"""
        summary = ["# Executive Summary - LLM Model Benchmarking", ""]
        summary.append(f"Date: {datetime.now().strftime('%Y-%m-%d')}")
        summary.append("")
        
        summary.append("## Key Findings")
        summary.append(f"- **Recommended Model**: **{comparison.recommended_model}**")
        summary.append(f"- **Rationale**: {comparison.recommendation_reason}")
        summary.append("")
        
        summary.append("## Quick Comparison")
        summary.append("")
        summary.append("| Model | Quality | Cost | Speed | Overall |")
        summary.append("|-------|---------|------|-------|---------|")
        
        # Calculate relative scores
        max_quality = max(comparison.quality_comparison.values())
        max_cost = max(comparison.cost_comparison.values())
        max_speed = max(comparison.speed_comparison.values())
        
        for model in summaries.keys():
            quality_stars = "⭐" * int((comparison.quality_comparison[model] / max_quality) * 5)
            cost_stars = "⭐" * int((1 - comparison.cost_comparison[model] / max_cost) * 5)
            speed_stars = "⭐" * int((1 - comparison.speed_comparison[model] / max_speed) * 5)
            overall = "🏆" if model == comparison.recommended_model else "✓"
            
            summary.append(f"| {model} | {quality_stars} | {cost_stars} | {speed_stars} | {overall} |")
        
        summary.append("")
        summary.append("## Bottom Line")
        summary.append(f"Switch to **{comparison.recommended_model}** for optimal results.")
        
        # Calculate potential savings/improvements
        current_model = list(summaries.keys())[0]  # Assume first is current
        if current_model != comparison.recommended_model:
            current_cost = comparison.cost_comparison[current_model]
            recommended_cost = comparison.cost_comparison[comparison.recommended_model]
            cost_savings = ((current_cost - recommended_cost) / current_cost) * 100
            
            if cost_savings > 0:
                summary.append(f"- Potential cost savings: {cost_savings:.1f}%")
            
            quality_improvement = comparison.quality_comparison[comparison.recommended_model] - \
                                comparison.quality_comparison[current_model]
            if quality_improvement > 0:
                summary.append(f"- Quality improvement: +{quality_improvement:.3f}")
        
        return "\n".join(summary)
    
    def _generate_charts(self, comparison: BenchmarkComparison,
                       summaries: Dict[str, ExperimentSummary],
                       output_dir: Path):
        """Generate visualization charts"""
        if not MATPLOTLIB_AVAILABLE:
            print("Matplotlib not available, cannot generate charts")
            return
        # Set up the figure with subplots
        fig = plt.figure(figsize=(16, 12))
        gs = GridSpec(3, 2, figure=fig, hspace=0.3, wspace=0.3)
        
        # 1. Quality Comparison Bar Chart
        ax1 = fig.add_subplot(gs[0, 0])
        models = list(comparison.quality_comparison.keys())
        qualities = list(comparison.quality_comparison.values())
        bars = ax1.bar(models, qualities)
        ax1.set_ylabel('Average Quality Score')
        ax1.set_title('Model Quality Comparison')
        ax1.set_ylim(0, 1)
        
        # Color the best performer
        best_idx = qualities.index(max(qualities))
        bars[best_idx].set_color('gold')
        
        # Add value labels
        for i, (model, quality) in enumerate(zip(models, qualities)):
            ax1.text(i, quality + 0.01, f'{quality:.3f}', ha='center')
        
        # 2. Cost Comparison
        ax2 = fig.add_subplot(gs[0, 1])
        costs = [comparison.cost_comparison[m] for m in models]
        bars = ax2.bar(models, costs)
        ax2.set_ylabel('Total Cost ($)')
        ax2.set_title('Cost Comparison')
        
        # Color the cheapest
        best_idx = costs.index(min(costs))
        bars[best_idx].set_color('lightgreen')
        
        # Add value labels
        for i, (model, cost) in enumerate(zip(models, costs)):
            ax2.text(i, cost + max(costs)*0.01, f'${cost:.4f}', ha='center')
        
        # 3. Speed Comparison
        ax3 = fig.add_subplot(gs[1, 0])
        speeds = [comparison.speed_comparison[m] for m in models]
        bars = ax3.bar(models, speeds)
        ax3.set_ylabel('Avg Time per URL (seconds)')
        ax3.set_title('Speed Comparison')
        
        # Color the fastest
        best_idx = speeds.index(min(speeds))
        bars[best_idx].set_color('lightblue')
        
        # Add value labels
        for i, (model, speed) in enumerate(zip(models, speeds)):
            ax3.text(i, speed + max(speeds)*0.01, f'{speed:.2f}s', ha='center')
        
        # 4. Success Rate Comparison
        ax4 = fig.add_subplot(gs[1, 1])
        success_rates = [summaries[m].success_rate for m in models]
        bars = ax4.bar(models, success_rates)
        ax4.set_ylabel('Success Rate')
        ax4.set_title('Extraction Success Rate')
        ax4.set_ylim(0, 1.1)
        
        # Add percentage labels
        for i, (model, rate) in enumerate(zip(models, success_rates)):
            ax4.text(i, rate + 0.01, f'{rate:.1%}', ha='center')
        
        # 5. Quality Distribution Stacked Bar
        ax5 = fig.add_subplot(gs[2, 0])
        
        # Prepare data for stacked bar chart
        score_ranges = ["0.0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"]
        bottoms = [0] * len(models)
        colors = ['red', 'orange', 'yellow', 'lightgreen', 'green']
        
        for i, score_range in enumerate(score_ranges):
            values = []
            for model in models:
                dist = summaries[model].quality_score_distribution
                count = dist.get(score_range, 0)
                total = summaries[model].successful_extractions
                percentage = (count / total * 100) if total > 0 else 0
                values.append(percentage)
            
            ax5.bar(models, values, bottom=bottoms, label=score_range, color=colors[i])
            bottoms = [b + v for b, v in zip(bottoms, values)]
        
        ax5.set_ylabel('Percentage of Results')
        ax5.set_title('Quality Score Distribution')
        ax5.legend(title='Score Range', bbox_to_anchor=(1.05, 1), loc='upper left')
        
        # 6. Cost vs Quality Scatter
        ax6 = fig.add_subplot(gs[2, 1])
        
        for model in models:
            quality = comparison.quality_comparison[model]
            cost_per_url = summaries[model].cost_per_url
            ax6.scatter(cost_per_url, quality, s=200, label=model)
            ax6.annotate(model, (cost_per_url, quality), xytext=(5, 5), 
                        textcoords='offset points')
        
        ax6.set_xlabel('Cost per URL ($)')
        ax6.set_ylabel('Average Quality Score')
        ax6.set_title('Cost vs Quality Trade-off')
        ax6.grid(True, alpha=0.3)
        
        # Add ideal zone
        ax6.axhspan(0.7, 1.0, alpha=0.1, color='green', label='High Quality Zone')
        ax6.axvspan(0, min(costs)/len(models)*1.5, alpha=0.1, color='blue', label='Low Cost Zone')
        
        plt.tight_layout()
        
        # Save the figure
        chart_path = output_dir / 'benchmark_comparison.png'
        plt.savefig(chart_path, dpi=150, bbox_inches='tight')
        plt.close()
        
        # Generate individual model performance charts
        self._generate_model_charts(summaries, output_dir)
    
    def _generate_model_charts(self, summaries: Dict[str, ExperimentSummary], output_dir: Path):
        """Generate individual charts for each model"""
        if not MATPLOTLIB_AVAILABLE:
            return
        for model, summary in summaries.items():
            fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(12, 10))
            fig.suptitle(f'{model} Performance Analysis', fontsize=16)
            
            # 1. Quality score histogram
            quality_scores = [r.quality_metrics.overall_score for r in summary.results 
                            if r.extraction_successful]
            if quality_scores:
                ax1.hist(quality_scores, bins=20, edgecolor='black', alpha=0.7)
                ax1.axvline(summary.avg_quality_score, color='red', linestyle='--', 
                          label=f'Mean: {summary.avg_quality_score:.3f}')
                ax1.set_xlabel('Quality Score')
                ax1.set_ylabel('Frequency')
                ax1.set_title('Quality Score Distribution')
                ax1.legend()
            
            # 2. Execution time distribution
            exec_times = [r.execution_time for r in summary.results]
            if exec_times:
                ax2.hist(exec_times, bins=20, edgecolor='black', alpha=0.7, color='orange')
                ax2.axvline(summary.avg_execution_time, color='red', linestyle='--',
                          label=f'Mean: {summary.avg_execution_time:.2f}s')
                ax2.set_xlabel('Execution Time (seconds)')
                ax2.set_ylabel('Frequency')
                ax2.set_title('Execution Time Distribution')
                ax2.legend()
            
            # 3. Token usage
            token_counts = [r.total_tokens for r in summary.results]
            if token_counts:
                ax3.hist(token_counts, bins=20, edgecolor='black', alpha=0.7, color='green')
                ax3.set_xlabel('Total Tokens')
                ax3.set_ylabel('Frequency')
                ax3.set_title('Token Usage Distribution')
                mean_tokens = sum(token_counts) / len(token_counts)
                ax3.axvline(mean_tokens, color='red', linestyle='--',
                          label=f'Mean: {mean_tokens:.0f}')
                ax3.legend()
            
            # 4. Common issues pie chart
            if summary.common_issues:
                issues = list(summary.common_issues.keys())[:5]  # Top 5
                counts = [summary.common_issues[i] for i in issues]
                
                # Truncate long issue descriptions
                issues_short = [i[:30] + '...' if len(i) > 30 else i for i in issues]
                
                ax4.pie(counts, labels=issues_short, autopct='%1.1f%%', startangle=90)
                ax4.set_title('Top Issues')
            else:
                ax4.text(0.5, 0.5, 'No issues found', ha='center', va='center')
                ax4.axis('off')
            
            plt.tight_layout()
            
            # Save
            model_chart_path = output_dir / f'{model}_analysis.png'
            plt.savefig(model_chart_path, dpi=150, bbox_inches='tight')
            plt.close()
    
    def generate_csv_comparison(self, summaries: Dict[str, ExperimentSummary], 
                              output_path: str = None) -> str:
        """Generate CSV file with detailed comparison data"""
        if not output_path:
            output_path = self.output_dir / f"comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        # Collect all results
        all_results = []
        for model, summary in summaries.items():
            for result in summary.results:
                all_results.append({
                    'model': model,
                    'url': result.url,
                    'success': result.extraction_successful,
                    'quality_score': result.quality_metrics.overall_score,
                    'json_parseable': result.quality_metrics.json_parseable,
                    'required_fields_present': result.quality_metrics.required_fields_present,
                    'url_valid': result.quality_metrics.url_valid,
                    'execution_time': result.execution_time,
                    'prompt_tokens': result.prompt_tokens,
                    'completion_tokens': result.completion_tokens,
                    'total_tokens': result.total_tokens,
                    'cost_usd': result.cost_usd,
                    'error': result.error_message or '',
                    'issues': '; '.join(result.quality_metrics.issues)
                })
        
        # Create DataFrame and save
        df = pd.DataFrame(all_results)
        df.to_csv(output_path, index=False)
        
        return str(output_path)