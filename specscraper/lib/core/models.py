"""Core data models for the scraping pipeline"""

from .scraping import ScrapeResult, ScrapingMethod
from .html_processor import ProcessedHTML
from .llm import PromptTemplator

# Re-export the classes with the expected names for backward compatibility
ProductExtractionResult = PromptTemplator.ProductExtractionOutput
ScrapeMethod = ScrapingMethod

__all__ = [
    "ScrapeResult",
    "ProcessedHTML", 
    "ProductExtractionResult",
    "ScrapeMethod"
]
