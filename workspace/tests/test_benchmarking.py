"""Tests for benchmarking functionality"""
import pytest
import tempfile
import json
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch
import sys

# Add project root to path
sys.path.append(str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from lib.benchmarking import CacheManager, ReportGenerator
from lib.benchmarking.models import (
    ExperimentConfig, ExperimentResult, ExperimentSummary,
    QualityMetrics, ModelProvider
)


class TestCacheManager:
    """Test the CacheManager class"""
    
    def setup_method(self):
        """Setup for each test"""
        self.temp_dir = tempfile.mkdtemp()
        self.cache_manager = CacheManager(cache_dir=self.temp_dir)
    
    def test_get_cache_key(self):
        """Test cache key generation"""
        url = "https://example.com/product"
        key = self.cache_manager.get_cache_key(url)
        
        assert key is not None
        assert len(key) == 32  # MD5 hash length
        
        # Same URL should generate same key
        key2 = self.cache_manager.get_cache_key(url)
        assert key == key2
        
        # Different URL should generate different key
        key3 = self.cache_manager.get_cache_key("https://different.com")
        assert key != key3
    
    def test_store_and_retrieve_html(self):
        """Test storing and retrieving HTML content"""
        url = "https://example.com/product"
        html_content = "<html><body>Test product page</body></html>"
        
        # Store HTML
        success = self.cache_manager.store_html(url, html_content)
        assert success
        
        # Retrieve HTML
        retrieved = self.cache_manager.get_cached_html(url)
        assert retrieved == html_content
    
    def test_has_cached(self):
        """Test checking if URL is cached"""
        url = "https://example.com/product"
        
        # Should not be cached initially
        assert not self.cache_manager.has_cached(url)
        
        # Store content
        self.cache_manager.store_html(url, "<html>Test</html>")
        
        # Should be cached now
        assert self.cache_manager.has_cached(url)
    
    def test_cache_stats(self):
        """Test cache statistics"""
        # Empty cache
        stats = self.cache_manager.get_cache_stats()
        assert stats["total_entries"] == 0
        assert stats["total_size_mb"] == 0
        
        # Add some content
        self.cache_manager.store_html("https://example.com/1", "<html>Content 1</html>")
        self.cache_manager.store_html("https://example.com/2", "<html>Content 2</html>")
        
        stats = self.cache_manager.get_cache_stats()
        assert stats["total_entries"] == 2
        assert stats["total_size_mb"] > 0
    
    def test_batch_cached_html(self):
        """Test getting cached HTML for multiple URLs"""
        urls = [
            "https://example.com/1",
            "https://example.com/2", 
            "https://example.com/3"
        ]
        
        # Cache some URLs
        self.cache_manager.store_html(urls[0], "<html>Content 1</html>")
        self.cache_manager.store_html(urls[2], "<html>Content 3</html>")
        
        # Get batch results
        results = self.cache_manager.get_batch_cached_html(urls)
        
        assert len(results) == 3
        assert results[urls[0]] == "<html>Content 1</html>"
        assert results[urls[1]] is None  # Not cached
        assert results[urls[2]] == "<html>Content 3</html>"
    
    def test_metadata_storage(self):
        """Test storing metadata with HTML"""
        url = "https://example.com/product"
        html_content = "<html>Test</html>"
        metadata = {
            'scrape_method': 'requests',
            'status_code': 200,
            'from_llm_results': True
        }
        
        success = self.cache_manager.store_html(url, html_content, metadata)
        assert success
        
        # Check that content can still be retrieved
        retrieved = self.cache_manager.get_cached_html(url)
        assert retrieved == html_content


class TestExperimentModels:
    """Test the experiment data models"""
    
    def test_experiment_config_creation(self):
        """Test creating an experiment configuration"""
        config = ExperimentConfig(
            experiment_id="test_001",
            model_name="gpt-4o-mini",
            prompt_version="v1"
        )
        
        assert config.experiment_id == "test_001"
        assert config.model_name == "gpt-4o-mini"
        assert config.temperature == 0.7  # Default value
        assert config.max_tokens == 1000  # Default value
        assert config.model_provider == ModelProvider.OPENAI  # Default
    
    def test_quality_metrics(self):
        """Test quality metrics model"""
        metrics = QualityMetrics(
            overall_score=0.85,
            field_scores={"image_url": 0.9, "description": 0.8},
            json_parseable=True,
            required_fields_present=True,
            url_valid=True,
            issues=["Minor formatting issue"]
        )
        
        assert metrics.overall_score == 0.85
        assert metrics.field_scores["image_url"] == 0.9
        assert len(metrics.issues) == 1
    
    def test_experiment_result(self):
        """Test experiment result model"""
        config = ExperimentConfig(
            experiment_id="test_001",
            model_name="gpt-4o-mini"
        )
        
        quality_metrics = QualityMetrics(
            overall_score=0.8,
            field_scores={},
            json_parseable=True,
            required_fields_present=True,
            url_valid=True
        )
        
        result = ExperimentResult(
            config=config,
            url="https://example.com",
            execution_time=2.5,
            prompt_tokens=500,
            completion_tokens=200,
            total_tokens=700,
            cost_usd=0.001,
            quality_metrics=quality_metrics,
            extraction_successful=True,
            prompt="Test prompt",
            raw_response='{"test": "response"}',
            extracted_data={"test": "response"}
        )
        
        assert result.url == "https://example.com"
        assert result.execution_time == 2.5
        assert result.total_tokens == 700
        assert result.extraction_successful
    
    def test_experiment_summary(self):
        """Test experiment summary model"""
        config = ExperimentConfig(
            experiment_id="test_001",
            model_name="gpt-4o-mini"
        )
        
        summary = ExperimentSummary(
            config=config,
            total_urls=10,
            successful_extractions=8,
            failed_extractions=2,
            total_cost=0.05,
            total_tokens=5000,
            avg_execution_time=2.0,
            success_rate=0.8,
            avg_quality_score=0.75,
            quality_score_distribution={"0.8-1.0": 5, "0.6-0.8": 3},
            common_issues={"Missing image URL": 2},
            tokens_per_second=250.0,
            cost_per_url=0.005,
            started_at=datetime.now(),
            completed_at=datetime.now(),
            duration_seconds=20.0
        )
        
        assert summary.total_urls == 10
        assert summary.success_rate == 0.8
        assert summary.avg_quality_score == 0.75


class TestReportGenerator:
    """Test the ReportGenerator class"""
    
    def setup_method(self):
        """Setup for each test"""
        self.temp_dir = tempfile.mkdtemp()
        self.report_generator = ReportGenerator(output_dir=self.temp_dir)
    
    def create_mock_experiment_summary(self, model_name: str, 
                                     quality_score: float = 0.8,
                                     total_cost: float = 0.05) -> ExperimentSummary:
        """Create a mock experiment summary for testing"""
        config = ExperimentConfig(
            experiment_id=f"test_{model_name}",
            model_name=model_name
        )
        
        # Create mock results
        quality_metrics = QualityMetrics(
            overall_score=quality_score,
            field_scores={"image_url": quality_score, "description": quality_score},
            json_parseable=True,
            required_fields_present=True,
            url_valid=True
        )
        
        results = [
            ExperimentResult(
                config=config,
                url=f"https://example.com/{i}",
                execution_time=2.0,
                prompt_tokens=500,
                completion_tokens=200,
                total_tokens=700,
                cost_usd=total_cost / 10,  # Assuming 10 URLs
                quality_metrics=quality_metrics,
                extraction_successful=True,
                prompt="Test prompt",
                raw_response='{"test": "response"}',
                extracted_data={"test": "response"}
            )
            for i in range(10)
        ]
        
        return ExperimentSummary(
            config=config,
            total_urls=10,
            successful_extractions=10,
            failed_extractions=0,
            total_cost=total_cost,
            total_tokens=7000,
            avg_execution_time=2.0,
            success_rate=1.0,
            avg_quality_score=quality_score,
            quality_score_distribution={"0.8-1.0": 10},
            common_issues={},
            tokens_per_second=350.0,
            cost_per_url=total_cost / 10,
            started_at=datetime.now(),
            completed_at=datetime.now(),
            duration_seconds=20.0,
            results=results
        )
    
    def test_create_benchmark_comparison(self):
        """Test creating benchmark comparison"""
        summaries = {
            "gpt-4o-mini": self.create_mock_experiment_summary("gpt-4o-mini", 0.85, 0.02),
            "gpt-4o": self.create_mock_experiment_summary("gpt-4o", 0.90, 0.10),
            "gpt-3.5-turbo": self.create_mock_experiment_summary("gpt-3.5-turbo", 0.75, 0.01)
        }
        
        comparison = self.report_generator._create_benchmark_comparison(summaries)
        
        assert len(comparison.experiment_summaries) == 3
        assert comparison.best_quality_model == "gpt-4o"  # Highest quality
        assert comparison.best_cost_model == "gpt-3.5-turbo"  # Lowest cost
        assert comparison.recommended_model in summaries.keys()
        
        # Check comparison metrics
        assert "gpt-4o-mini" in comparison.comparison_metrics
        assert "avg_quality" in comparison.comparison_metrics["gpt-4o-mini"]
        assert "total_cost" in comparison.comparison_metrics["gpt-4o-mini"]
    
    @patch('matplotlib.pyplot.savefig')  # Mock to avoid actual file creation
    @patch('matplotlib.pyplot.close')
    def test_generate_comparison_report(self, mock_close, mock_savefig):
        """Test generating a complete comparison report"""
        summaries = {
            "gpt-4o-mini": self.create_mock_experiment_summary("gpt-4o-mini", 0.85, 0.02),
            "gpt-4o": self.create_mock_experiment_summary("gpt-4o", 0.90, 0.10)
        }
        
        report_path = self.report_generator.generate_comparison_report(
            summaries, "test_report"
        )
        
        # Check that files were created
        assert Path(report_path).exists()
        
        # Read and check report content
        with open(report_path, 'r') as f:
            content = f.read()
        
        assert "LLM Model Benchmarking Report" in content
        assert "gpt-4o-mini" in content
        assert "gpt-4o" in content
        assert "Executive Summary" in content
        assert "Detailed Comparison" in content
    
    def test_generate_executive_summary(self):
        """Test generating executive summary"""
        summaries = {
            "gpt-4o-mini": self.create_mock_experiment_summary("gpt-4o-mini", 0.85, 0.02),
            "gpt-4o": self.create_mock_experiment_summary("gpt-4o", 0.90, 0.10)
        }
        
        comparison = self.report_generator._create_benchmark_comparison(summaries)
        summary = self.report_generator._generate_executive_summary(comparison, summaries)
        
        assert "Executive Summary" in summary
        assert "Recommended Model" in summary
        assert "Quick Comparison" in summary
        assert comparison.recommended_model in summary
    
    def test_generate_csv_comparison(self):
        """Test generating CSV comparison"""
        summaries = {
            "gpt-4o-mini": self.create_mock_experiment_summary("gpt-4o-mini", 0.85, 0.02)
        }
        
        csv_path = self.report_generator.generate_csv_comparison(summaries)
        
        assert Path(csv_path).exists()
        
        # Check CSV content
        import pandas as pd
        df = pd.read_csv(csv_path)
        
        assert len(df) == 10  # 10 URLs in mock summary
        assert "model" in df.columns
        assert "url" in df.columns
        assert "quality_score" in df.columns
        assert all(df["model"] == "gpt-4o-mini")


# Integration tests
class TestBenchmarkingIntegration:
    """Integration tests for benchmarking components"""
    
    def test_cache_integration(self):
        """Test cache manager integration"""
        temp_dir = tempfile.mkdtemp()
        cache_manager = CacheManager(cache_dir=temp_dir)
        
        # Test workflow
        urls = ["https://example.com/1", "https://example.com/2"]
        
        # Store content
        for i, url in enumerate(urls):
            content = f"<html>Content {i+1}</html>"
            cache_manager.store_html(url, content)
        
        # Batch retrieve
        results = cache_manager.get_batch_cached_html(urls)
        
        assert len(results) == 2
        assert all(results[url] is not None for url in urls)
        
        # Check stats
        stats = cache_manager.get_cache_stats()
        assert stats["total_entries"] == 2
    
    def test_report_generation_workflow(self):
        """Test complete report generation workflow"""
        temp_dir = tempfile.mkdtemp()
        generator = ReportGenerator(output_dir=temp_dir)
        
        # Create test data
        summaries = {
            "model_a": ExperimentSummary(
                config=ExperimentConfig(experiment_id="test_a", model_name="model_a"),
                total_urls=5,
                successful_extractions=4,
                failed_extractions=1,
                total_cost=0.02,
                total_tokens=2000,
                avg_execution_time=1.5,
                success_rate=0.8,
                avg_quality_score=0.75,
                quality_score_distribution={"0.6-0.8": 4},
                common_issues={},
                tokens_per_second=200.0,
                cost_per_url=0.004,
                started_at=datetime.now(),
                completed_at=datetime.now(),
                duration_seconds=10.0,
                results=[]
            )
        }
        
        # Generate comparison
        comparison = generator._create_benchmark_comparison(summaries)
        
        assert comparison.recommended_model == "model_a"
        assert len(comparison.experiment_summaries) == 1


# Fixtures
@pytest.fixture
def temp_cache_dir():
    """Provide temporary cache directory"""
    return tempfile.mkdtemp()


@pytest.fixture 
def sample_experiment_config():
    """Provide sample experiment configuration"""
    return ExperimentConfig(
        experiment_id="test_experiment",
        model_name="gpt-4o-mini",
        prompt_version="v1"
    )


@pytest.fixture
def sample_quality_metrics():
    """Provide sample quality metrics"""
    return QualityMetrics(
        overall_score=0.85,
        field_scores={"image_url": 0.9, "description": 0.8},
        json_parseable=True,
        required_fields_present=True,
        url_valid=True,
        issues=[]
    )