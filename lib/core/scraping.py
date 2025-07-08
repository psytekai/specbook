import requests
import time
import random
import logging
import json
import os
from typing import Optional, Dict, Any, List, Tuple, Set
from urllib.parse import urljoin, urlparse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import undetected_chromedriver as uc
import math
from firecrawl import FirecrawlApp
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
import threading

# Load environment variables
load_dotenv()

# Create logs directory if it doesn't exist
os.makedirs('logs', exist_ok=True)

# Generate timestamped log filename
log_filename = os.path.join('logs', f'stealth_scraper.log')

# Configure logging with detailed format, but only to file
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(log_filename),
        logging.StreamHandler()
    ]
)

# Create logger for this module
logger = logging.getLogger('StealthScraper')

class ScrapingMethod(str, Enum):
    """Enumeration of available scraping methods"""
    REQUESTS = "requests"
    FIRECRAWL = "firecrawl"
    AUTO = "auto"

class PageIssue(str, Enum):
    """Enumeration of possible page issues"""
    BOT_DETECTED = "bot_detected"
    CAPTCHA_PRESENT = "captcha_present"
    EMPTY_CONTENT = "empty_content"
    ERROR_PAGE = "error_page"
    REDIRECT_LOOP = "redirect_loop"
    TIMEOUT = "timeout"
    JAVASCRIPT_REQUIRED = "javascript_required"

class ScrapeResult(BaseModel):
    """Standardized result object for all scraping methods"""
    # Success indicators
    success: bool = Field(description="Whether the scraping was successful")
    status_code: Optional[int] = Field(default=None, description="HTTP status code if available")
    
    # Content
    content: Optional[str] = Field(default=None, description="The scraped content if successful")
    final_url: str = Field(description="The final URL after any redirects")
    
    # Method tracking
    methods_tried: Set[ScrapingMethod] = Field(default_factory=set, description="List of scraping methods attempted")
    final_method: ScrapingMethod = Field(description="The final method used to scrape the content")
    
    # Error information
    error_reason: Optional[str] = Field(default=None, description="Human-readable error message")
    page_issues: List[PageIssue] = Field(default_factory=list, description="List of detected page issues")
    
    # Additional metadata
    url: str = Field(description="The URL that was scraped")
    scrape_time: float = Field(default=0.0, description="Time taken to scrape in seconds")
    attempts: int = Field(default=1, description="Number of attempts made")
    warnings: List[str] = Field(default_factory=list, description="List of warnings encountered")

    def add_warning(self, warning: str) -> None:
        """Add a warning message to the result"""
        self.warnings.append(warning)

    def add_page_issue(self, issue: PageIssue) -> None:
        """Add a page issue to the result"""
        if issue not in self.page_issues:
            self.page_issues.append(issue)

    def add_method_tried(self, method: ScrapingMethod) -> None:
        """Add a method to the list of tried methods"""
        self.methods_tried.add(method)


class StealthConfig:
    """Configuration for stealth settings"""
    
    def __init__(self):
        self.window_sizes = [
            (1920, 1080),
            (1366, 768),
            (1440, 900),
            (1536, 864),
            (1280, 720)
        ]
        
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
        ]
        
        self.languages = [
            'en-US,en;q=0.9',
            'en-GB,en;q=0.9',
            'en-CA,en;q=0.9',
            'en-AU,en;q=0.9'
        ]
        
        self.timezones = [
            'America/New_York',
            'America/Los_Angeles',
            'America/Chicago',
            'Europe/London',
            'Europe/Paris'
        ]
        
        self.screen_resolutions = [
            '1920x1080',
            '1366x768',
            '1440x900',
            '1536x864',
            '1280x720'
        ]
        
        self.color_depths = [24, 32]
        self.pixel_ratios = [1, 1.25, 1.5, 2]
        
    def get_random_config(self) -> Dict[str, Any]:
        """Get a random but consistent set of stealth parameters"""
        return {
            'window_size': random.choice(self.window_sizes),
            'user_agent': random.choice(self.user_agents),
            'language': random.choice(self.languages),
            'timezone': random.choice(self.timezones),
            'screen_resolution': random.choice(self.screen_resolutions),
            'color_depth': random.choice(self.color_depths),
            'pixel_ratio': random.choice(self.pixel_ratios)
        }

class StealthScraper:
    """Web scraper with anti-bot detection measures"""
    
    # Class-level logger setup
    logger = logging.getLogger('StealthScraper')
    
    def __init__(self):
        # Concurrency control
        self._semaphore = threading.Semaphore(2)
        
        # Rate limiting - single lock for atomic operations
        self._rate_lock = threading.Lock()
        self._request_count = 0
        self._window_start = time.time()

        self.session = requests.Session()

        # Get Firecrawl API key from environment variable
        self.firecrawl_api_key = os.getenv('FIRECRAWL_API_KEY')
        
        if not self.firecrawl_api_key:
            self.logger.warning("FIRECRAWL_API_KEY not found in environment variables")
        else:
            self.firecrawl = FirecrawlApp(api_key=self.firecrawl_api_key)
        
        # Initialize stealth configuration
        self.stealth_config = StealthConfig()
        self.current_config = self.stealth_config.get_random_config()
        
        # Setup requests session with realistic headers
        self.setup_session()

    def _acquire_rate_limit(self):
        """Handle rate limiting logic"""
        with self._rate_lock:
            current_time = time.time()
            
            # Reset window if 60 seconds have passed
            if current_time - self._window_start >= 60:
                self._window_start = current_time
                self._request_count = 0
            
            # If we've hit the limit, wait
            if self._request_count >= 10:
                wait_time = 60 - (current_time - self._window_start)
                if wait_time > 0:
                    time.sleep(wait_time)
                # Reset after waiting
                self._window_start = time.time()
                self._request_count = 0
            
            # Increment count
            self._request_count += 1
        
    def setup_session(self):
        """Configure requests session with realistic headers"""
        self.session.headers.update({
            'User-Agent': self.current_config['user_agent'],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': self.current_config['language'],
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        })

    def scrape_url(self, url: str, method: str = "auto", **kwargs) -> ScrapeResult:
        """
        Main scraping method that chooses the best approach

        Args:
            url: URL to scrape
            method: "requests", "selenium", "auto", or "firecrawl"
            **kwargs: Additional arguments

        Returns:
            ScrapeResult: Standardized result object containing success status, content, and metadata
        """
        start_time = time.time()
        all_methods_tried = set()
        all_page_issues = []
        total_attempts = 0

        if method == "firecrawl":
            return self.scrape_with_firecrawl(url)

        if method == "requests":
            return self.scrape_with_requests(url, **kwargs)

        else:  # auto - try methods in sequence
            # Try requests first
            request_result = self.scrape_with_requests(url, **kwargs)

            all_methods_tried.update(request_result.methods_tried)
            all_page_issues.extend(request_result.page_issues)
            total_attempts += request_result.attempts

            # Return immediately on 404
            if request_result.status_code == 404:
                request_result.methods_tried = all_methods_tried
                request_result.scrape_time = time.time() - start_time
                request_result.attempts = total_attempts
                return request_result

            # Check if requests was successful and bot wasn't detected
            if request_result.success and PageIssue.BOT_DETECTED not in request_result.page_issues:
                request_result.methods_tried = all_methods_tried
                request_result.scrape_time = time.time() - start_time
                request_result.attempts = total_attempts
                return request_result

            # If requests failed and Firecrawl is available, try it
            if self.firecrawl_api_key:
                self.logger.info("Requests failed, trying Firecrawl...")
                firecrawl_result = self.scrape_with_firecrawl(url)

                firecrawl_result.methods_tried.update(all_methods_tried)
                firecrawl_result.attempts += total_attempts
                firecrawl_result.scrape_time = time.time() - start_time
                firecrawl_result.page_issues = all_page_issues

                return firecrawl_result

            return request_result

    def scrape_with_requests(self, url: str, retries: int = 3, delay_range: Tuple[int, int] = (1, 3)) -> ScrapeResult:
        """
        Scrape using requests with anti-detection measures
        
        Returns:
            ScrapeResult: Standardized result object containing success status, content, and metadata
        """
        start_time = time.time()
        
        for attempt in range(retries):
            try:
                # Random delay between requests
                if attempt > 0:
                    delay = random.uniform(*delay_range)
                    self.logger.info(f"Retry {attempt + 1}/{retries} after {delay:.1f}s delay")
                    time.sleep(delay)
                
                # Rotate stealth config occasionally
                if random.random() < 0.3:  # 30% chance to rotate
                    self.current_config = self.stealth_config.get_random_config()
                    self.setup_session()
                    self.logger.info("Rotated stealth configuration")
                
                # Add referer header to look more natural
                domain = urlparse(url).netloc
                referer = f"https://{domain}/"
                
                headers = dict(self.session.headers)
                headers['Referer'] = referer
                
                response = self.session.get(url, headers=headers, timeout=10)
                
                # Early return for 404
                if response.status_code == 404:
                    return ScrapeResult(
                        url=url,
                        success=False,
                        error_reason="Page not found",
                        status_code=404,
                        final_url=response.url,
                        methods_tried={ScrapingMethod.REQUESTS},
                        final_method=ScrapingMethod.REQUESTS,
                        scrape_time=time.time() - start_time,
                        attempts=attempt + 1
                    )
                
                # Check for other error status codes
                if response.status_code >= 400:
                    self.logger.warning(f"HTTP {response.status_code} error")
                    return ScrapeResult(
                        url=url,
                        success=False,
                        error_reason=f"HTTP {response.status_code} error",
                        status_code=response.status_code,
                        final_url=response.url,
                        methods_tried={ScrapingMethod.REQUESTS},
                        final_method=ScrapingMethod.REQUESTS,
                        scrape_time=time.time() - start_time,
                        attempts=attempt + 1
                    )
                
                content = response.text
                page_issues = []
                
                # Check for CAPTCHA
                # if self.is_captcha_present(content)['present']:
                #     page_issues.append(PageIssue.CAPTCHA_PRESENT)
                #     return ScrapeResult(
                #         success=False,
                #         error_reason=f"CAPTCHA detected",
                #         status_code=403,
                #         final_url=response.url,
                #         methods_tried={ScrapingMethod.REQUESTS},
                #         final_method=ScrapingMethod.REQUESTS,
                #         scrape_time=time.time() - start_time,
                #         attempts=attempt + 1,
                #         page_issues=page_issues
                #     )
                
                # Check for bot detection
                if self.is_bot_detected(content):
                    page_issues.append(PageIssue.BOT_DETECTED)
                    if attempt == retries - 1:
                        return ScrapeResult(
                            url=url,
                            success=False,
                            error_reason="Bot detection active",
                            status_code=403,
                            final_url=response.url,
                            methods_tried={ScrapingMethod.REQUESTS},
                            final_method=ScrapingMethod.REQUESTS,
                            scrape_time=time.time() - start_time,
                            attempts=attempt + 1,
                            page_issues=page_issues
                        )
                    continue
                
                # Check for empty content
                if len(content.strip()) < 100:
                    page_issues.append(PageIssue.EMPTY_CONTENT)
                
                response.raise_for_status()
                self.logger.info(f"Successfully scraped URL with requests ({len(content)} chars)")
                return ScrapeResult(
                    url=url,
                    success=True,
                    content=content,
                    status_code=response.status_code,
                    final_url=response.url,
                    methods_tried={ScrapingMethod.REQUESTS},
                    final_method=ScrapingMethod.REQUESTS,
                    scrape_time=time.time() - start_time,
                    attempts=attempt + 1,
                    page_issues=page_issues
                )
                
            except requests.RequestException as e:
                self.logger.error(f"Request failed on attempt {attempt + 1}: {e}")
                if attempt == retries - 1:
                    return ScrapeResult(
                        url=url,
                        success=False,
                        error_reason=str(e),
                        status_code=getattr(e.response, 'status_code', 500),
                        final_url=url,
                        methods_tried={ScrapingMethod.REQUESTS},
                        final_method=ScrapingMethod.REQUESTS,
                        scrape_time=time.time() - start_time,
                        attempts=attempt + 1
                    )
        
        return ScrapeResult(
            url=url,
            success=False,
            error_reason="Max retries exceeded",
            status_code=500,
            final_url=url,
            methods_tried={ScrapingMethod.REQUESTS},
            final_method=ScrapingMethod.REQUESTS,
            scrape_time=time.time() - start_time,
            attempts=retries
        )
    
    def is_bot_detected(self, html_content):
        """Check if the response indicates bot detection"""
        bot_indicators = [
            "pardon our interruption",
            "you were browsing something about your browser made us think you were a bot",
            # "please make sure that cookies and javascript are enabled",
            # "why have i been blocked",
            # "enable javascript and cookies",
            # "browser check",
            # "ddos protection",
            # # Add Incapsula detection
            # "incapsula",
            # "incident_id",
            # "request unsuccessful",
            # "main-iframe",
            # "_incapsula_resource",
            # "swudnsai",
            # "xinfo"
        ]
        
        content_lower = html_content.lower()
        return any(indicator in content_lower for indicator in bot_indicators)
    
    def is_captcha_present(self, html_content):
        """
        Check if a CAPTCHA challenge is present in the response
        
        Returns:
            dict: {
                'present': bool,
                'type': str,  # 'recaptcha', 'hcaptcha', 'cloudflare', 'funcaptcha', 'incapsula', 'other'
                'indicators': list  # List of found indicators
            }
        """
        captcha_indicators = {
            'recaptcha': [
                'recaptcha',
                'g-recaptcha',
                'grecaptcha',
                'google.com/recaptcha',
                'recaptcha-checkbox',
                'recaptcha-anchor',
                'i\'m not a robot'
            ],
            'hcaptcha': [
                'hcaptcha',
                'h-captcha',
                'hcaptcha.com',
                'hcaptcha-checkbox'
            ],
            'cloudflare': [
                'cf-challenge',
                'cloudflare',
                'cf-ray',
                'checking your browser',
                'cloudflare-static',
                'cf-browser-verification',
                'please wait while we check your browser',
                'ddos protection by cloudflare'
            ],
            'incapsula': [
                'incapsula',
                'incident_id',
                'request unsuccessful',
                'main-iframe',
                '_incapsula_resource',
                'swudnsai',
                'xinfo'
            ],
            'funcaptcha': [
                'funcaptcha',
                'arkoselabs',
                'arkose',
                'fun-captcha'
            ],
            'other': [
                'captcha',
                'security check',
                'verify you are human',
                'prove you are not a robot',
                'complete the challenge',
                'solve the puzzle',
                'anti-bot verification'
            ]
        }
        
        content_lower = html_content.lower()
        found_indicators = []
        captcha_types = []
        
        for captcha_type, indicators in captcha_indicators.items():
            type_found = False
            for indicator in indicators:
                if indicator in content_lower:
                    found_indicators.append(indicator)
                    if not type_found:
                        captcha_types.append(captcha_type)
                        type_found = True
        
        return {
            'present': len(found_indicators) > 0,
            'type': captcha_types[0] if captcha_types else None,
            'all_types': captcha_types,
            'indicators': found_indicators
        }
    
    def detect_page_issues(self, html_content) -> Dict[str, Any]:
        """
        Comprehensive detection of page loading issues
        
        Returns:
            dict: Summary of all detected issues
        """
        issues = {
            'bot_detected': self.is_bot_detected(html_content),
            'captcha': self.is_captcha_present(html_content),
            'empty_content': len(html_content.strip()) < 100,
            'error_page': False,
            'redirect_loop': False,
            'timeout_page': False
        }
        
        # Check for error pages
        error_indicators = [
            '404 not found',
            '403 forbidden',
            '500 internal server error',
            'page not found',
            'access forbidden',
            'server error'
        ]
        
        content_lower = html_content.lower()
        issues['error_page'] = any(indicator in content_lower for indicator in error_indicators)
        
        # Check for timeout/loading issues
        timeout_indicators = [
            'timeout',
            'took too long to respond',
            'connection timed out',
            'request timeout'
        ]
        
        issues['timeout_page'] = any(indicator in content_lower for indicator in timeout_indicators)
        
        return issues

    def scrape_with_firecrawl(self, url: str) -> ScrapeResult:
        """
        Scrape using Firecrawl SDK as a fallback
        
        Returns:
            ScrapeResult: Standardized result object containing success status, content, and metadata
        """
        start_time = time.time()
        
        with self._semaphore:
            self.logger.info(f"Starting Firecrawl scrape for {url}")
            self._acquire_rate_limit()
            self.logger.info(f"Acquired rate limit for {url}")

            if not self.firecrawl_api_key:
                self.logger.error("Firecrawl API key not provided")
                return ScrapeResult(
                    url=url,
                    success=False,
                    status_code=500,
                    error_reason="Firecrawl API key not provided",
                    methods_tried={ScrapingMethod.FIRECRAWL},
                    final_method=ScrapingMethod.FIRECRAWL,
                    final_url=url,
                    scrape_time=time.time() - start_time
                )

            try:
                self.logger.info(f"Calling Firecrawl API with timeout=30000ms for {url}")
                firecrawl_result = self.firecrawl.scrape_url(
                    url,
                    formats=['rawHtml'],
                    only_main_content=False,
                    timeout=60000,  # Increased timeout to 60 seconds
                    parse_pdf=False,
                    max_age=14400000
                )
                
                elapsed_time = time.time() - start_time
                self.logger.info(f"Firecrawl API call completed in {elapsed_time:.2f}s")
                self.logger.debug(f"Firecrawl result structure: success={getattr(firecrawl_result, 'success', None)}, error={getattr(firecrawl_result, 'error', None)}")

                if hasattr(firecrawl_result, 'success') and firecrawl_result.success:
                    content_length = len(firecrawl_result.rawHtml) if hasattr(firecrawl_result, 'rawHtml') else 0
                    self.logger.info(f"Firecrawl success for {url}: {content_length} characters scraped")
                    
                    return ScrapeResult(
                        url=url,
                        success=True,
                        status_code=200,
                        content=firecrawl_result.rawHtml,
                        methods_tried={ScrapingMethod.FIRECRAWL},
                        final_method=ScrapingMethod.FIRECRAWL,
                        final_url=url,
                        scrape_time=elapsed_time
                    )

                if hasattr(firecrawl_result, 'error') and firecrawl_result.error:
                    self.logger.error(f"Firecrawl API error for {url}: {firecrawl_result.error}")
                    return ScrapeResult(
                        url=url,
                        success=False,
                        status_code=500,
                        error_reason=firecrawl_result.error,
                        methods_tried={ScrapingMethod.FIRECRAWL},
                        final_method=ScrapingMethod.FIRECRAWL,
                        final_url=url,
                        scrape_time=elapsed_time
                    )

                self.logger.warning(f"Firecrawl returned unexpected result format for {url}")
                return ScrapeResult(
                    url=url,
                    success=False,
                    status_code=500,
                    error_reason="Unexpected Firecrawl response format",
                    methods_tried={ScrapingMethod.FIRECRAWL},
                    final_method=ScrapingMethod.FIRECRAWL,
                    final_url=url,
                    scrape_time=elapsed_time
                )

            except Exception as e:
                elapsed_time = time.time() - start_time
                error_type = type(e).__name__
                self.logger.error(f"Firecrawl exception ({error_type}) for {url} after {elapsed_time:.2f}s: {str(e)}")
                
                # Add specific handling for timeout errors
                if "timeout" in str(e).lower() or "timed out" in str(e).lower():
                    self.logger.error(f"Firecrawl timeout detected for {url} - consider increasing timeout or checking target site responsiveness")
                
                return ScrapeResult(
                    url=url,
                    success=False,
                    status_code=500,
                    error_reason=f"{error_type}: {str(e)}",
                    methods_tried={ScrapingMethod.FIRECRAWL},
                    final_method=ScrapingMethod.FIRECRAWL,
                    final_url=url,
                    scrape_time=elapsed_time
                )


# Example usage
if __name__ == "__main__":
    import pandas as pd
    
    df = pd.read_csv('../01_llmpipeline/specbook.csv')

    product_urls = df["product_url"].to_list()
    scraper = StealthScraper()

    for url in product_urls:
        result = scraper.scrape_url(url, method="auto")

