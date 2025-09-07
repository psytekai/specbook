"""
Theranchmine Phase 1 Library - Core Pipeline Components

This library provides reusable components for web scraping, LLM processing,
monitoring, and benchmarking of product extraction pipelines.
"""

# Core components
from .core.scraping import StealthScraper
from .core.html_processor import HTMLProcessor
from .core.llm import LLMInvocator, PromptTemplator
from .core.evaluation import ProductExtractionEvaluator
from .core.models import (
    ScrapeResult, ProcessedHTML, ProductExtractionResult,
    ScrapeMethod
)

# Monitoring components
from .monitoring.pipeline_monitor import PipelineMonitor
from .monitoring.metrics_collector import MetricsCollector
from .monitoring.error_analyzer import ErrorAnalyzer
from .monitoring.models import (
    PipelineExecution, PipelineMetric, PipelineError,
    PipelineStage, MetricType, ErrorCategory
)

# Benchmarking components
from .benchmarking.experiment_runner import ExperimentRunner
from .benchmarking.cache_manager import CacheManager
from .benchmarking.report_generator import ReportGenerator
from .benchmarking.models import (
    ExperimentConfig, ExperimentResult, ExperimentSummary,
    QualityMetrics, ModelProvider
)

# Utilities
from .utils.openai_rate_limiter import OpenAIRateLimiter

__version__ = "1.0.0"
__all__ = [
    # Core
    "StealthScraper", "HTMLProcessor", "LLMInvocator", "PromptTemplator",
    "ProductExtractionEvaluator", "ScrapeResult", "ProcessedHTML",
    "ProductExtractionResult", "ScrapeMethod",
    
    # Monitoring
    "PipelineMonitor", "MetricsCollector", "ErrorAnalyzer",
    "PipelineExecution", "PipelineMetric", "PipelineError",
    "PipelineStage", "MetricType", "ErrorCategory",
    
    # Benchmarking
    "ExperimentRunner", "CacheManager", "ReportGenerator",
    "ExperimentConfig", "ExperimentResult", "ExperimentSummary",
    "QualityMetrics", "ModelProvider",
    
    # Utils
    "OpenAIRateLimiter"
]