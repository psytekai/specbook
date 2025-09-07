"""Core monitoring data structures for pipeline execution tracking"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Optional
from enum import Enum


class PipelineStage(str, Enum):
    """Stages of the pipeline execution"""
    SCRAPING = "scraping"
    HTML_PROCESSING = "html_processing"
    LLM_EXTRACTION = "llm_extraction"
    VALIDATION = "validation"


class MetricType(str, Enum):
    """Types of metrics we can collect"""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"


class ErrorCategory(str, Enum):
    """Categories of errors that can occur in the pipeline"""
    NETWORK_ERROR = "network_error"
    BOT_DETECTION = "bot_detection"
    RATE_LIMIT = "rate_limit"
    LLM_ERROR = "llm_error"
    VALIDATION_ERROR = "validation_error"
    FIRECRAWL_ERROR = "firecrawl_error"
    UNKNOWN_ERROR = "unknown_error"


class PipelineMetric(BaseModel):
    """Single metric measurement"""
    name: str = Field(description="Name of the metric")
    value: float = Field(description="Value of the metric")
    type: MetricType = Field(description="Type of metric")
    labels: Dict[str, str] = Field(default_factory=dict, description="Additional labels for the metric")
    timestamp: datetime = Field(default_factory=datetime.now, description="When the metric was recorded")
    stage: Optional[PipelineStage] = Field(default=None, description="Pipeline stage where metric was recorded")


class PipelineError(BaseModel):
    """Error information from pipeline execution"""
    category: ErrorCategory = Field(description="Category of the error")
    stage: PipelineStage = Field(description="Stage where error occurred")
    url: str = Field(description="URL being processed when error occurred")
    error_message: str = Field(description="Detailed error message")
    timestamp: datetime = Field(default_factory=datetime.now, description="When the error occurred")
    additional_info: Dict[str, str] = Field(default_factory=dict, description="Additional error context")


class PipelineExecution(BaseModel):
    """Complete pipeline execution record"""
    execution_id: str = Field(description="Unique identifier for this execution")
    start_time: datetime = Field(description="When execution started")
    end_time: Optional[datetime] = Field(default=None, description="When execution ended")
    total_urls: int = Field(description="Total number of URLs to process")
    
    # Success/failure counters
    successful_scrapes: int = Field(default=0, description="Number of successful scrapes")
    failed_scrapes: int = Field(default=0, description="Number of failed scrapes")
    successful_llm_calls: int = Field(default=0, description="Number of successful LLM calls")
    failed_llm_calls: int = Field(default=0, description="Number of failed LLM calls")
    
    # Error tracking
    bot_detections: int = Field(default=0, description="Number of bot detections")
    rate_limit_errors: int = Field(default=0, description="Number of rate limit errors")
    network_errors: int = Field(default=0, description="Number of network errors")
    validation_errors: int = Field(default=0, description="Number of validation errors")
    
    # Cost tracking
    total_cost: float = Field(default=0.0, description="Total cost in USD")
    openai_cost: float = Field(default=0.0, description="OpenAI API cost")
    firecrawl_cost: float = Field(default=0.0, description="Firecrawl API cost")
    
    # Detailed tracking
    metrics: List[PipelineMetric] = Field(default_factory=list, description="All metrics collected")
    errors: List[PipelineError] = Field(default_factory=list, description="All errors encountered")
    
    # Computed properties
    @property
    def duration(self) -> Optional[float]:
        """Duration of execution in seconds"""
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return None
    
    @property
    def success_rate(self) -> float:
        """Overall success rate"""
        total_attempts = self.successful_scrapes + self.failed_scrapes
        if total_attempts == 0:
            return 0.0
        return self.successful_scrapes / total_attempts
    
    @property
    def llm_success_rate(self) -> float:
        """LLM call success rate"""
        total_llm_calls = self.successful_llm_calls + self.failed_llm_calls
        if total_llm_calls == 0:
            return 0.0
        return self.successful_llm_calls / total_llm_calls