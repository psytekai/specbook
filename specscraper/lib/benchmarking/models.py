"""Benchmarking data structures for experiment tracking"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum


class ModelProvider(str, Enum):
    """Supported model providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"  # Future support


class ExperimentConfig(BaseModel):
    """Configuration for a benchmarking experiment"""
    experiment_id: str = Field(description="Unique identifier for the experiment")
    model_name: str = Field(description="Name of the model (e.g., gpt-4o-mini)")
    model_provider: ModelProvider = Field(default=ModelProvider.OPENAI)
    temperature: float = Field(default=0.7, description="Sampling temperature")
    max_tokens: int = Field(default=1000, description="Maximum tokens in response")
    prompt_template: str = Field(default="default", description="Prompt template identifier")
    prompt_version: str = Field(default="v1", description="Version of the prompt template")
    created_at: datetime = Field(default_factory=datetime.now)
    additional_params: Dict[str, Any] = Field(default_factory=dict)


class QualityMetrics(BaseModel):
    """Quality metrics from product extraction evaluation"""
    overall_score: float = Field(description="Overall quality score (0-1)")
    field_scores: Dict[str, float] = Field(description="Individual field quality scores")
    json_parseable: bool = Field(description="Whether the output was valid JSON")
    required_fields_present: bool = Field(description="Whether all required fields were present")
    url_valid: bool = Field(description="Whether extracted URLs were valid")
    issues: List[str] = Field(default_factory=list, description="List of quality issues")


class ExperimentResult(BaseModel):
    """Results from a single experiment run"""
    config: ExperimentConfig = Field(description="Configuration used for this experiment")
    url: str = Field(description="URL that was processed")
    execution_time: float = Field(description="Time taken to process in seconds")
    
    # Cost metrics
    prompt_tokens: int = Field(description="Number of tokens in the prompt")
    completion_tokens: int = Field(description="Number of tokens in the completion")
    total_tokens: int = Field(description="Total tokens used")
    cost_usd: float = Field(description="Cost in USD")
    
    # Quality metrics
    quality_metrics: QualityMetrics = Field(description="Quality evaluation results")
    extraction_successful: bool = Field(description="Whether extraction succeeded")
    
    # Raw data
    prompt: str = Field(description="The actual prompt sent to the model")
    raw_response: str = Field(description="Raw response from the model")
    extracted_data: Dict[str, Any] = Field(description="Extracted product data")
    
    # Error tracking
    error_message: Optional[str] = Field(default=None, description="Error message if failed")
    timestamp: datetime = Field(default_factory=datetime.now)


class ExperimentSummary(BaseModel):
    """Summary of an entire experiment across multiple URLs"""
    config: ExperimentConfig
    total_urls: int
    successful_extractions: int
    failed_extractions: int
    
    # Aggregate metrics
    total_cost: float
    total_tokens: int
    avg_execution_time: float
    success_rate: float
    
    # Quality summary
    avg_quality_score: float
    quality_score_distribution: Dict[str, int]  # Score ranges to count
    common_issues: Dict[str, int]  # Issue type to count
    
    # Performance metrics
    tokens_per_second: float
    cost_per_url: float
    
    # Timestamps
    started_at: datetime
    completed_at: datetime
    duration_seconds: float
    
    # Detailed results
    results: List[ExperimentResult] = Field(default_factory=list)


class BenchmarkComparison(BaseModel):
    """Comparison results between multiple experiments"""
    experiment_summaries: List[ExperimentSummary]
    comparison_metrics: Dict[str, Dict[str, float]]  # model -> metric -> value
    
    # Winner determination
    best_quality_model: str
    best_cost_model: str
    best_speed_model: str
    recommended_model: str
    recommendation_reason: str
    
    # Detailed comparisons
    quality_comparison: Dict[str, float]  # model -> avg quality
    cost_comparison: Dict[str, float]  # model -> total cost
    speed_comparison: Dict[str, float]  # model -> avg execution time
    
    # Statistical significance (if applicable)
    quality_variance: Dict[str, float]
    significant_differences: List[str]