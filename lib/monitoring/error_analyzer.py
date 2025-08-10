"""Error analysis and categorization for pipeline monitoring"""
import json
from collections import defaultdict
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import pandas as pd
from .models import PipelineError, ErrorCategory, PipelineExecution, PipelineStage


class ErrorAnalyzer:
    """Analyzes and categorizes errors from pipeline executions"""
    
    def __init__(self):
        self.error_patterns = {
            ErrorCategory.BOT_DETECTION: [
                "bot", "captcha", "cloudflare", "blocked", "forbidden", 
                "access denied", "anti-bot", "recaptcha", "challenge"
            ],
            ErrorCategory.RATE_LIMIT: [
                "rate limit", "too many requests", "429", "quota exceeded",
                "throttled", "retry after"
            ],
            ErrorCategory.NETWORK_ERROR: [
                "timeout", "connection", "network", "dns", "ssl", 
                "certificate", "unreachable", "refused"
            ],
            ErrorCategory.FIRECRAWL_ERROR: [
                "firecrawl", "insufficient tokens", "firecrawl api"
            ],
            ErrorCategory.LLM_ERROR: [
                "openai", "gpt", "model", "completion", "api key", 
                "invalid response", "json decode"
            ],
            ErrorCategory.VALIDATION_ERROR: [
                "validation", "invalid", "missing field", "parse error",
                "format error", "type error"
            ]
        }
    
    def analyze_errors(self, executions: List[PipelineExecution]) -> Dict[str, Any]:
        """Analyze errors across multiple executions"""
        all_errors = []
        for execution in executions:
            all_errors.extend(execution.errors)
        
        if not all_errors:
            return {"total_errors": 0, "error_analysis": {}}
        
        # Group by category
        errors_by_category = defaultdict(list)
        for error in all_errors:
            errors_by_category[error.category.value].append(error)
        
        # Group by stage
        errors_by_stage = defaultdict(list)
        for error in all_errors:
            errors_by_stage[error.stage.value].append(error)
        
        # Find most common error messages
        error_messages = defaultdict(int)
        for error in all_errors:
            # Normalize error message for grouping
            normalized = self._normalize_error_message(error.error_message)
            error_messages[normalized] += 1
        
        # Analyze error patterns over time
        error_timeline = self._create_error_timeline(all_errors)
        
        # Generate actionable insights
        insights = self._generate_insights(errors_by_category, errors_by_stage)
        
        return {
            "total_errors": len(all_errors),
            "errors_by_category": {
                cat: len(errors) for cat, errors in errors_by_category.items()
            },
            "errors_by_stage": {
                stage: len(errors) for stage, errors in errors_by_stage.items()
            },
            "top_error_messages": dict(sorted(
                error_messages.items(), 
                key=lambda x: x[1], 
                reverse=True
            )[:10]),
            "error_timeline": error_timeline,
            "insights": insights,
            "affected_urls": self._get_affected_urls(all_errors)
        }
    
    def categorize_error_message(self, error_message: str) -> ErrorCategory:
        """Categorize an error message based on patterns"""
        error_lower = error_message.lower()
        
        for category, patterns in self.error_patterns.items():
            if any(pattern in error_lower for pattern in patterns):
                return category
                
        return ErrorCategory.UNKNOWN_ERROR
    
    def generate_error_report(self, executions: List[PipelineExecution]) -> str:
        """Generate a human-readable error report"""
        analysis = self.analyze_errors(executions)
        
        if analysis["total_errors"] == 0:
            return "# Error Analysis Report\n\nNo errors found in the analyzed executions."
        
        report = ["# Error Analysis Report", ""]
        report.append(f"Total Errors: {analysis['total_errors']}")
        report.append("")
        
        # Error breakdown by category
        report.append("## Errors by Category")
        for category, count in sorted(analysis["errors_by_category"].items(), key=lambda x: x[1], reverse=True):
            percentage = (count / analysis["total_errors"]) * 100
            report.append(f"- **{category}**: {count} ({percentage:.1f}%)")
        report.append("")
        
        # Error breakdown by stage
        report.append("## Errors by Pipeline Stage")
        for stage, count in sorted(analysis["errors_by_stage"].items(), key=lambda x: x[1], reverse=True):
            percentage = (count / analysis["total_errors"]) * 100
            report.append(f"- **{stage}**: {count} ({percentage:.1f}%)")
        report.append("")
        
        # Top error messages
        report.append("## Most Common Error Messages")
        for i, (msg, count) in enumerate(list(analysis["top_error_messages"].items())[:5], 1):
            report.append(f"{i}. `{msg}` - {count} occurrences")
        report.append("")
        
        # Actionable insights
        report.append("## Actionable Insights")
        for insight in analysis["insights"]:
            report.append(f"- {insight}")
        report.append("")
        
        # Affected URLs
        if analysis["affected_urls"]:
            report.append("## Most Affected URLs")
            for url, count in list(analysis["affected_urls"].items())[:10]:
                report.append(f"- {url}: {count} errors")
        
        return "\n".join(report)
    
    def get_error_resolution_suggestions(self, error: PipelineError) -> List[str]:
        """Get suggestions for resolving specific errors"""
        suggestions = []
        
        if error.category == ErrorCategory.BOT_DETECTION:
            suggestions.extend([
                "Consider using Firecrawl as fallback for this URL",
                "Add more realistic browser headers and behaviors",
                "Implement random delays between requests",
                "Check if the site requires specific cookies or session data"
            ])
        elif error.category == ErrorCategory.RATE_LIMIT:
            suggestions.extend([
                "Reduce concurrent workers in ThreadPoolExecutor",
                "Implement exponential backoff for retries",
                "Add delays between requests to the same domain",
                "Consider spreading requests over a longer time period"
            ])
        elif error.category == ErrorCategory.NETWORK_ERROR:
            suggestions.extend([
                "Check network connectivity and DNS resolution",
                "Increase timeout values for slow-loading sites",
                "Implement retry logic with backoff",
                "Verify SSL certificates are valid"
            ])
        elif error.category == ErrorCategory.FIRECRAWL_ERROR:
            suggestions.extend([
                "Check Firecrawl API token balance",
                "Reduce the number of Firecrawl requests",
                "Cache successful Firecrawl results",
                "Consider upgrading Firecrawl plan for more tokens"
            ])
        elif error.category == ErrorCategory.LLM_ERROR:
            suggestions.extend([
                "Verify OpenAI API key is valid",
                "Check OpenAI API rate limits and quotas",
                "Reduce prompt size if hitting token limits",
                "Implement retry logic for transient API errors"
            ])
        elif error.category == ErrorCategory.VALIDATION_ERROR:
            suggestions.extend([
                "Review the HTML cleaning process",
                "Check if website structure has changed",
                "Validate that all required fields are extracted",
                "Consider more robust error handling in extraction"
            ])
        
        return suggestions
    
    def _normalize_error_message(self, message: str) -> str:
        """Normalize error message for grouping similar errors"""
        # Remove URLs
        import re
        message = re.sub(r'https?://\S+', '<URL>', message)
        
        # Remove numbers that might be IDs or codes
        message = re.sub(r'\b\d{3,}\b', '<NUMBER>', message)
        
        # Remove file paths
        message = re.sub(r'[/\\][\w/\\.-]+', '<PATH>', message)
        
        # Truncate very long messages
        if len(message) > 100:
            message = message[:100] + "..."
            
        return message.strip()
    
    def _create_error_timeline(self, errors: List[PipelineError]) -> Dict[str, int]:
        """Create timeline of errors by hour"""
        timeline = defaultdict(int)
        
        for error in errors:
            hour_key = error.timestamp.strftime("%Y-%m-%d %H:00")
            timeline[hour_key] += 1
            
        return dict(sorted(timeline.items()))
    
    def _generate_insights(self, errors_by_category: Dict[str, List[PipelineError]], 
                         errors_by_stage: Dict[str, List[PipelineError]]) -> List[str]:
        """Generate actionable insights from error analysis"""
        insights = []
        
        # Check for high bot detection rate
        bot_errors = len(errors_by_category.get(ErrorCategory.BOT_DETECTION.value, []))
        total_errors = sum(len(errors) for errors in errors_by_category.values())
        
        if total_errors > 0:
            bot_rate = bot_errors / total_errors
            if bot_rate > 0.3:
                insights.append(
                    f"High bot detection rate ({bot_rate:.1%}) - Consider implementing more sophisticated "
                    f"anti-detection measures or increasing Firecrawl usage"
                )
        
        # Check for rate limiting issues
        rate_limit_errors = len(errors_by_category.get(ErrorCategory.RATE_LIMIT.value, []))
        if rate_limit_errors > 5:
            insights.append(
                f"Multiple rate limit errors ({rate_limit_errors}) - Reduce concurrent workers "
                f"or implement better rate limiting"
            )
        
        # Check for concentration of errors in specific stages
        for stage, errors in errors_by_stage.items():
            stage_error_rate = len(errors) / total_errors if total_errors > 0 else 0
            if stage_error_rate > 0.5:
                insights.append(
                    f"Most errors ({stage_error_rate:.1%}) occur in {stage} stage - "
                    f"Focus optimization efforts here"
                )
        
        # Check for network issues
        network_errors = len(errors_by_category.get(ErrorCategory.NETWORK_ERROR.value, []))
        if network_errors > 10:
            insights.append(
                f"High number of network errors ({network_errors}) - Check network stability "
                f"and consider implementing retries"
            )
        
        return insights
    
    def _get_affected_urls(self, errors: List[PipelineError]) -> Dict[str, int]:
        """Get URLs most affected by errors"""
        url_errors = defaultdict(int)
        
        for error in errors:
            if error.url:
                url_errors[error.url] += 1
                
        return dict(sorted(url_errors.items(), key=lambda x: x[1], reverse=True))
    
    def export_error_analysis(self, executions: List[PipelineExecution], output_path: str):
        """Export detailed error analysis to CSV"""
        all_errors = []
        
        for execution in executions:
            for error in execution.errors:
                all_errors.append({
                    "execution_id": execution.execution_id,
                    "timestamp": error.timestamp,
                    "category": error.category.value,
                    "stage": error.stage.value,
                    "url": error.url,
                    "error_message": error.error_message,
                    "additional_info": json.dumps(error.additional_info)
                })
        
        if all_errors:
            df = pd.DataFrame(all_errors)
            df.to_csv(output_path, index=False)
            return output_path
        
        return None