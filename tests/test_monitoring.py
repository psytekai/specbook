"""Tests for monitoring functionality"""
import pytest
import tempfile
from datetime import datetime
from pathlib import Path

from tools.monitoring.pipeline_monitor import PipelineMonitor
from tools.monitoring.metrics_collector import MetricsCollector
from tools.monitoring.error_analyzer import ErrorAnalyzer
from tools.monitoring.models import (
    PipelineMetric, PipelineError, PipelineExecution,
    MetricType, ErrorCategory, PipelineStage
)
from tools.stealth_scraper import ScrapeResult, ScrapingMethod, PageIssue


class TestPipelineMonitor:
    """Test the PipelineMonitor class"""
    
    def setup_method(self):
        """Setup for each test"""
        # Use temporary directory for tests
        self.temp_dir = tempfile.mkdtemp()
        self.monitor = PipelineMonitor(metrics_dir=self.temp_dir)
    
    def test_start_execution(self):
        """Test starting a pipeline execution"""
        execution_id = self.monitor.start_execution(total_urls=10)
        
        assert execution_id is not None
        assert execution_id.startswith("exec_")
        assert self.monitor.current_execution is not None
        assert self.monitor.current_execution.total_urls == 10
        assert self.monitor.current_execution.successful_scrapes == 0
    
    def test_record_successful_scrape(self):
        """Test recording a successful scrape result"""
        self.monitor.start_execution(total_urls=1)
        
        # Create mock successful scrape result
        result = ScrapeResult(
            success=True,
            url="https://example.com",
            status_code=200,
            content="<html>Test content</html>",
            final_url="https://example.com",
            final_method=ScrapingMethod.REQUESTS
        )
        
        self.monitor.record_scrape_result(result)
        
        assert self.monitor.current_execution.successful_scrapes == 1
        assert self.monitor.current_execution.failed_scrapes == 0
    
    def test_record_failed_scrape(self):
        """Test recording a failed scrape result"""
        self.monitor.start_execution(total_urls=1)
        
        # Create mock failed scrape result
        result = ScrapeResult(
            success=False,
            url="https://example.com",
            status_code=404,
            content=None,
            final_url="https://example.com",
            final_method=ScrapingMethod.REQUESTS,
            error_reason="Page not found",
            page_issues=[PageIssue.ERROR_PAGE]
        )
        
        self.monitor.record_scrape_result(result)
        
        assert self.monitor.current_execution.successful_scrapes == 0
        assert self.monitor.current_execution.failed_scrapes == 1
    
    def test_record_bot_detection(self):
        """Test recording bot detection"""
        self.monitor.start_execution(total_urls=1)
        
        result = ScrapeResult(
            success=False,
            url="https://example.com",
            status_code=403,
            content=None,
            final_url="https://example.com",
            final_method=ScrapingMethod.REQUESTS,
            error_reason="Bot detected",
            page_issues=[PageIssue.BOT_DETECTED]
        )
        
        self.monitor.record_scrape_result(result)
        
        assert self.monitor.current_execution.bot_detections == 1
    
    def test_record_llm_success(self):
        """Test recording successful LLM result"""
        self.monitor.start_execution(total_urls=1)
        
        self.monitor.record_llm_result(
            success=True,
            model="gpt-4o-mini",
            tokens_used=1000,
            cost=0.001
        )
        
        assert self.monitor.current_execution.successful_llm_calls == 1
        assert self.monitor.current_execution.failed_llm_calls == 0
        assert self.monitor.current_execution.openai_cost == 0.001
        assert self.monitor.current_execution.total_cost == 0.001
    
    def test_record_llm_failure(self):
        """Test recording failed LLM result"""
        self.monitor.start_execution(total_urls=1)
        
        self.monitor.record_llm_result(
            success=False,
            model="gpt-4o-mini",
            error="Rate limit exceeded"
        )
        
        assert self.monitor.current_execution.successful_llm_calls == 0
        assert self.monitor.current_execution.failed_llm_calls == 1
        assert self.monitor.current_execution.rate_limit_errors == 1
    
    def test_end_execution(self):
        """Test ending an execution"""
        self.monitor.start_execution(total_urls=5)
        
        # Simulate some activity
        self.monitor.record_metric(
            name="test.metric",
            value=1.0,
            metric_type=MetricType.COUNTER
        )
        
        execution = self.monitor.end_execution()
        
        assert execution is not None
        assert execution.end_time is not None
        assert execution.duration is not None
        assert execution.duration > 0
        assert self.monitor.current_execution is None  # Should be cleared
    
    def test_get_current_stats(self):
        """Test getting current statistics"""
        # No execution started
        stats = self.monitor.get_current_stats()
        assert stats is None
        
        # With execution
        self.monitor.start_execution(total_urls=10)
        stats = self.monitor.get_current_stats()
        
        assert stats is not None
        assert "execution_id" in stats
        assert "total_urls" in stats
        assert "progress" in stats
        assert stats["total_urls"] == 10


class TestMetricsCollector:
    """Test the MetricsCollector class"""
    
    def setup_method(self):
        """Setup for each test"""
        self.temp_dir = tempfile.mkdtemp()
        self.collector = MetricsCollector(metrics_dir=self.temp_dir)
    
    def create_mock_execution(self, execution_id: str = "test_exec") -> PipelineExecution:
        """Create a mock pipeline execution for testing"""
        return PipelineExecution(
            execution_id=execution_id,
            start_time=datetime.now(),
            end_time=datetime.now(),
            total_urls=10,
            successful_scrapes=8,
            failed_scrapes=2,
            successful_llm_calls=8,
            failed_llm_calls=0,
            total_cost=0.05,
            openai_cost=0.05,
            metrics=[
                PipelineMetric(
                    name="scrape.success",
                    value=8,
                    type=MetricType.COUNTER,
                    stage=PipelineStage.SCRAPING
                ),
                PipelineMetric(
                    name="scrape.duration_seconds",
                    value=2.5,
                    type=MetricType.HISTOGRAM,
                    stage=PipelineStage.SCRAPING
                )
            ]
        )
    
    def test_calculate_summary_stats(self):
        """Test calculating summary statistics"""
        executions = [
            self.create_mock_execution("exec1"),
            self.create_mock_execution("exec2")
        ]
        
        stats = self.collector.calculate_summary_stats(executions)
        
        assert stats["executions"] == 2
        assert stats["total_urls"] == 20
        assert stats["total_scraped"] == 20  # 8+2 per execution
        assert stats["total_successful"] == 16  # 8 per execution
        assert stats["overall_success_rate"] == 0.8  # 16/20
        assert stats["cost"]["total"] == 0.1  # 0.05 per execution
    
    def test_aggregate_metrics(self):
        """Test metric aggregation"""
        executions = [self.create_mock_execution()]
        
        aggregated = self.collector.aggregate_metrics(executions)
        
        assert "scrape.success" in aggregated
        assert "scrape.duration_seconds" in aggregated
        
        counter_metric = aggregated["scrape.success"]
        assert counter_metric["type"] == "counter"
        assert counter_metric["total"] == 8
        
        histogram_metric = aggregated["scrape.duration_seconds"]
        assert histogram_metric["type"] == "histogram"
        assert histogram_metric["mean"] == 2.5
    
    def test_generate_metrics_report(self):
        """Test generating a metrics report"""
        executions = [self.create_mock_execution()]
        
        report = self.collector.generate_metrics_report(executions)
        
        assert "Pipeline Metrics Report" in report
        assert "Summary Statistics" in report
        assert "Error Breakdown" in report
        assert "Cost Analysis" in report


class TestErrorAnalyzer:
    """Test the ErrorAnalyzer class"""
    
    def setup_method(self):
        """Setup for each test"""
        self.analyzer = ErrorAnalyzer()
    
    def create_mock_error(self, category: ErrorCategory, message: str) -> PipelineError:
        """Create a mock error for testing"""
        return PipelineError(
            category=category,
            stage=PipelineStage.SCRAPING,
            url="https://example.com",
            error_message=message
        )
    
    def test_categorize_error_message(self):
        """Test error message categorization"""
        # Bot detection
        assert self.analyzer.categorize_error_message("Bot detected") == ErrorCategory.BOT_DETECTION
        assert self.analyzer.categorize_error_message("Cloudflare challenge") == ErrorCategory.BOT_DETECTION
        
        # Rate limiting
        assert self.analyzer.categorize_error_message("Rate limit exceeded") == ErrorCategory.RATE_LIMIT
        assert self.analyzer.categorize_error_message("429 Too Many Requests") == ErrorCategory.RATE_LIMIT
        
        # Network errors
        assert self.analyzer.categorize_error_message("Connection timeout") == ErrorCategory.NETWORK_ERROR
        assert self.analyzer.categorize_error_message("DNS resolution failed") == ErrorCategory.NETWORK_ERROR
        
        # Unknown errors
        assert self.analyzer.categorize_error_message("Something weird happened") == ErrorCategory.UNKNOWN_ERROR
    
    def test_analyze_errors_empty(self):
        """Test analyzing empty error list"""
        executions = [PipelineExecution(
            execution_id="test",
            start_time=datetime.now(),
            total_urls=10,
            errors=[]
        )]
        
        analysis = self.analyzer.analyze_errors(executions)
        
        assert analysis["total_errors"] == 0
        assert analysis["error_analysis"] == {}
    
    def test_analyze_errors_with_data(self):
        """Test analyzing errors with data"""
        errors = [
            self.create_mock_error(ErrorCategory.BOT_DETECTION, "Bot detected"),
            self.create_mock_error(ErrorCategory.BOT_DETECTION, "Captcha present"),
            self.create_mock_error(ErrorCategory.RATE_LIMIT, "Rate limit exceeded"),
        ]
        
        execution = PipelineExecution(
            execution_id="test",
            start_time=datetime.now(),
            total_urls=10,
            errors=errors
        )
        
        analysis = self.analyzer.analyze_errors([execution])
        
        assert analysis["total_errors"] == 3
        assert analysis["errors_by_category"]["bot_detection"] == 2
        assert analysis["errors_by_category"]["rate_limit"] == 1
        assert "scraping" in analysis["errors_by_stage"]
    
    def test_get_error_resolution_suggestions(self):
        """Test getting error resolution suggestions"""
        bot_error = self.create_mock_error(ErrorCategory.BOT_DETECTION, "Bot detected")
        suggestions = self.analyzer.get_error_resolution_suggestions(bot_error)
        
        assert len(suggestions) > 0
        assert any("Firecrawl" in suggestion for suggestion in suggestions)
        assert any("headers" in suggestion for suggestion in suggestions)
    
    def test_generate_error_report(self):
        """Test generating error report"""
        errors = [
            self.create_mock_error(ErrorCategory.BOT_DETECTION, "Bot detected"),
            self.create_mock_error(ErrorCategory.RATE_LIMIT, "Rate limit exceeded"),
        ]
        
        execution = PipelineExecution(
            execution_id="test",
            start_time=datetime.now(),
            total_urls=10,
            errors=errors
        )
        
        report = self.analyzer.generate_error_report([execution])
        
        assert "Error Analysis Report" in report
        assert "Errors by Category" in report
        assert "bot_detection" in report
        assert "rate_limit" in report


# Fixtures for pytest
@pytest.fixture
def temp_dir():
    """Provide a temporary directory for tests"""
    import tempfile
    return tempfile.mkdtemp()


@pytest.fixture
def mock_scrape_result():
    """Provide a mock scrape result"""
    return ScrapeResult(
        success=True,
        url="https://example.com",
        status_code=200,
        content="<html>Test content</html>",
        final_url="https://example.com",
        final_method=ScrapingMethod.REQUESTS
    )


# Integration tests
class TestMonitoringIntegration:
    """Integration tests for monitoring components"""
    
    def test_full_pipeline_monitoring(self, temp_dir):
        """Test full pipeline monitoring workflow"""
        monitor = PipelineMonitor(metrics_dir=temp_dir)
        
        # Start execution
        execution_id = monitor.start_execution(total_urls=2)
        
        # Record successful scrape
        success_result = ScrapeResult(
            success=True,
            url="https://example.com/1",
            status_code=200,
            content="<html>Content 1</html>",
            final_url="https://example.com/1",
            final_method=ScrapingMethod.REQUESTS
        )
        monitor.record_scrape_result(success_result)
        
        # Record failed scrape
        fail_result = ScrapeResult(
            success=False,
            url="https://example.com/2",
            status_code=403,
            content=None,
            final_url="https://example.com/2",
            final_method=ScrapingMethod.REQUESTS,
            error_reason="Bot detected",
            page_issues=[PageIssue.BOT_DETECTED]
        )
        monitor.record_scrape_result(fail_result)
        
        # Record LLM results
        monitor.record_llm_result(success=True, model="gpt-4o-mini", tokens_used=500, cost=0.001)
        
        # End execution
        execution = monitor.end_execution()
        
        # Verify results
        assert execution.successful_scrapes == 1
        assert execution.failed_scrapes == 1
        assert execution.bot_detections == 1
        assert execution.successful_llm_calls == 1
        assert execution.total_cost == 0.001
        
        # Test metrics collection
        collector = MetricsCollector(metrics_dir=temp_dir)
        stats = collector.calculate_summary_stats([execution])
        
        assert stats["total_urls"] == 2
        assert stats["overall_success_rate"] == 0.5  # 1/2
        
        # Test error analysis
        analyzer = ErrorAnalyzer()
        error_analysis = analyzer.analyze_errors([execution])
        
        assert error_analysis["total_errors"] == 1  # The bot detection error
        assert "bot_detection" in error_analysis["errors_by_category"]