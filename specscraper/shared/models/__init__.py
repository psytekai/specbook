"""Shared data models across all PRPs"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class ExecutionStatus(Enum):
    """Status of PRP execution"""
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PRPExecution(BaseModel):
    """Metadata for PRP execution tracking"""
    execution_id: str
    prp_id: str
    prp_implementation: str
    execution_date: datetime
    status: ExecutionStatus
    description: str
    objectives: List[str] = Field(default_factory=list)
    configuration: Dict[str, Any] = Field(default_factory=dict)
    results_summary: Dict[str, Any] = Field(default_factory=dict)
    generated_artifacts: List[str] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class PRPImplementation(BaseModel):
    """Metadata for PRP implementation"""
    implementation_id: str
    prp_id: str
    implementation_date: datetime
    status: str
    description: str
    features: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)
    configuration_schema: Dict[str, Any] = Field(default_factory=dict)
    created_by: str = "system"
    version: str = "1.0.0"


class SystemMetrics(BaseModel):
    """System-wide metrics tracking"""
    timestamp: datetime = Field(default_factory=datetime.now)
    total_executions: int = 0
    successful_executions: int = 0
    failed_executions: int = 0
    total_urls_processed: int = 0
    total_cost_usd: float = 0.0
    avg_quality_score: float = 0.0
    cache_hit_rate: float = 0.0
    system_uptime_hours: float = 0.0