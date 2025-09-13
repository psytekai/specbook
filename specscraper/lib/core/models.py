"""Core data models used across the application"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class ScrapeMethod(Enum):
    """Methods available for scraping"""
    REQUESTS = "requests"
    FIRECRAWL = "firecrawl"
    AUTO = "auto"


class ScrapeResult(BaseModel):
    """Result from scraping a URL"""
    url: str
    success: bool
    content: Optional[str] = None
    error_reason: Optional[str] = None
    final_method: ScrapeMethod
    status_code: Optional[int] = None
    execution_time: float
    attempts: Dict[str, bool] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ProcessedHTML(BaseModel):
    """Processed and cleaned HTML content"""
    title: str
    metadata: Dict[str, str] = Field(default_factory=dict)
    text: str
    images: List[Dict[str, str]] = Field(default_factory=list)
    links: List[Dict[str, str]] = Field(default_factory=list)
    cleaned_html: str
    processing_time: float
    word_count: int
    image_count: int
    
    
class ProductExtractionResult(BaseModel):
    """Result from product data extraction"""
    url: str
    success: bool
    extracted_data: Dict[str, Any] = Field(default_factory=dict)
    raw_response: str = ""
    error_message: Optional[str] = None
    execution_time: float
    model_used: str
    tokens_used: int
    cost_usd: float
    quality_score: float = 0.0
    created_at: datetime = Field(default_factory=datetime.now)