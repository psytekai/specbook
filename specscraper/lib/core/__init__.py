"""Core pipeline components"""
from .scraping import StealthScraper
from .html_processor import HTMLProcessor
from .llm import LLMInvocator, PromptTemplator
# Removed evaluation import to reduce bundle size - not needed for electron_bridge
# from .evaluation import ProductExtractionEvaluator
from .models import (
    ScrapeResult, ProcessedHTML, ProductExtractionResult,
    ScrapeMethod
)

__all__ = [
    "StealthScraper", "HTMLProcessor", "LLMInvocator", "PromptTemplator",
    # "ProductExtractionEvaluator",  # Removed to reduce bundle size
    "ScrapeResult", "ProcessedHTML",
    "ProductExtractionResult", "ScrapeMethod"
]