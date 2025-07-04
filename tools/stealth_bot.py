import requests
import time
import random
import logging
import json
from typing import Optional, Dict, Any, List, Tuple
from urllib.parse import urljoin, urlparse
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import undetected_chromedriver as uc
import math

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Set specific log levels for different components
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('selenium').setLevel(logging.WARNING)
logging.getLogger('playwright').setLevel(logging.WARNING)

# Create a file handler to log to a file
file_handler = logging.FileHandler('stealth_bot.log')
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
))
file_handler.setLevel(logging.DEBUG)

# Add file handler to root logger
logging.getLogger().addHandler(file_handler)

logger = logging.getLogger('AntiDetectionScraper')

class CaptchaSolver:
    """Interface for solving CAPTCHAs using various services"""
    
    # Class-level logger setup
    logger = logging.getLogger('CaptchaSolver')
    
    def __init__(self, api_key: Optional[str] = None, service: str = "2captcha"):
        self.api_key = api_key
        self.service = service.lower()
        
        if not api_key:
            self.logger.warning("No API key provided for CAPTCHA solving. Manual intervention may be required.")
    
    async def solve_recaptcha(self, site_key: str, page_url: str) -> Optional[str]:
        """Solve Google reCAPTCHA"""
        if not self.api_key:
            self.logger.error("Cannot solve reCAPTCHA without API key")
            return None
            
        try:
            if self.service == "2captcha":
                return await self._solve_2captcha_recaptcha(site_key, page_url)
            elif self.service == "anticaptcha":
                return await self._solve_anticaptcha_recaptcha(site_key, page_url)
            else:
                self.logger.error(f"Unsupported CAPTCHA service: {self.service}")
                return None
        except Exception as e:
            self.logger.error(f"Failed to solve reCAPTCHA: {e}")
            return None
    
    async def solve_hcaptcha(self, site_key: str, page_url: str) -> Optional[str]:
        """Solve hCaptcha"""
        if not self.api_key:
            self.logger.error("Cannot solve hCaptcha without API key")
            return None
            
        try:
            if self.service == "2captcha":
                return await self._solve_2captcha_hcaptcha(site_key, page_url)
            elif self.service == "anticaptcha":
                return await self._solve_anticaptcha_hcaptcha(site_key, page_url)
            else:
                self.logger.error(f"Unsupported CAPTCHA service: {self.service}")
                return None
        except Exception as e:
            self.logger.error(f"Failed to solve hCaptcha: {e}")
            return None
    
    async def _solve_2captcha_recaptcha(self, site_key: str, page_url: str) -> Optional[str]:
        """Solve reCAPTCHA using 2captcha service"""
        try:
            # Submit CAPTCHA
            params = {
                'key': self.api_key,
                'method': 'userrecaptcha',
                'googlekey': site_key,
                'pageurl': page_url,
                'json': 1
            }
            response = requests.post('https://2captcha.com/in.php', params=params)
            data = response.json()
            
            if data['status'] != 1:
                self.logger.error(f"Failed to submit CAPTCHA to 2captcha: {data['error_text']}")
                return None
            
            # Get request ID
            request_id = data['request']
            
            # Wait for solution (max 5 minutes)
            for _ in range(30):
                time.sleep(10)  # Wait 10 seconds between checks
                
                # Check solution status
                params = {
                    'key': self.api_key,
                    'action': 'get',
                    'id': request_id,
                    'json': 1
                }
                response = requests.get('https://2captcha.com/res.php', params=params)
                data = response.json()
                
                if data['status'] == 1:
                    self.logger.info("Successfully solved reCAPTCHA")
                    return data['request']  # This is the solution token
                    
            self.logger.error("Timeout waiting for CAPTCHA solution")
            return None
            
        except Exception as e:
            self.logger.error(f"Error solving reCAPTCHA with 2captcha: {e}")
            return None
    
    async def _solve_2captcha_hcaptcha(self, site_key: str, page_url: str) -> Optional[str]:
        """Solve hCaptcha using 2captcha service"""
        try:
            # Submit CAPTCHA
            params = {
                'key': self.api_key,
                'method': 'hcaptcha',
                'sitekey': site_key,
                'pageurl': page_url,
                'json': 1
            }
            response = requests.post('https://2captcha.com/in.php', params=params)
            data = response.json()
            
            if data['status'] != 1:
                self.logger.error(f"Failed to submit hCaptcha to 2captcha: {data['error_text']}")
                return None
            
            # Get request ID
            request_id = data['request']
            
            # Wait for solution (max 5 minutes)
            for _ in range(30):
                time.sleep(10)  # Wait 10 seconds between checks
                
                # Check solution status
                params = {
                    'key': self.api_key,
                    'action': 'get',
                    'id': request_id,
                    'json': 1
                }
                response = requests.get('https://2captcha.com/res.php', params=params)
                data = response.json()
                
                if data['status'] == 1:
                    self.logger.info("Successfully solved hCaptcha")
                    return data['request']  # This is the solution token
                    
            self.logger.error("Timeout waiting for CAPTCHA solution")
            return None
            
        except Exception as e:
            self.logger.error(f"Error solving hCaptcha with 2captcha: {e}")
            return None
    
    async def _solve_anticaptcha_recaptcha(self, site_key: str, page_url: str) -> Optional[str]:
        """Solve reCAPTCHA using anti-captcha.com service"""
        # Implementation similar to 2captcha but with anti-captcha.com API
        self.logger.error("Anti-captcha.com implementation not yet available")
        return None
    
    async def _solve_anticaptcha_hcaptcha(self, site_key: str, page_url: str) -> Optional[str]:
        """Solve hCaptcha using anti-captcha.com service"""
        # Implementation similar to 2captcha but with anti-captcha.com API
        self.logger.error("Anti-captcha.com implementation not yet available")
        return None

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

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("Playwright not available. Install with: pip install playwright")

class AntiDetectionScraper:
    """Web scraper with anti-bot detection measures"""
    
    # Class-level logger setup
    logger = logging.getLogger('AntiDetectionScraper')
    
    def __init__(self, use_selenium=True, use_playwright=True, headless=False, captcha_api_key: Optional[str] = None):
        self.session = requests.Session()
        self.use_selenium = use_selenium
        self.use_playwright = use_playwright and PLAYWRIGHT_AVAILABLE
        self.headless = headless
        self.driver = None
        self.playwright = None
        self.browser = None
        self.page = None
        
        # Initialize stealth configuration
        self.stealth_config = StealthConfig()
        self.current_config = self.stealth_config.get_random_config()
        
        # Initialize CAPTCHA solver
        self.captcha_solver = CaptchaSolver(api_key=captcha_api_key) if captcha_api_key else None
        
        # Setup requests session with realistic headers
        self.setup_session()
        
        if use_selenium:
            self.setup_selenium()
    
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
    
    def setup_selenium(self):
        """Setup undetected Chrome driver with enhanced stealth"""
        try:
            options = uc.ChromeOptions()
            
            if self.headless:
                options.add_argument("--headless")
            
            # Apply stealth configuration
            window_size = self.current_config['window_size']
            options.add_argument(f"--window-size={window_size[0]},{window_size[1]}")
            options.add_argument(f"--user-agent={self.current_config['user_agent']}")
            
            # Additional stealth options
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("--disable-extensions")
            options.add_argument("--disable-plugins-discovery")
            
            # Add WebGL vendor and renderer
            options.add_argument("--use-gl=desktop")  # Enable GPU acceleration
            options.add_argument("--use-angle=default")  # Use default ANGLE backend
            
            # Add additional privacy options
            options.add_argument("--disable-web-security")  # Disable same-origin policy
            options.add_argument("--disable-features=IsolateOrigins,site-per-process")  # Disable site isolation
            
            self.driver = uc.Chrome(options=options)
            
            # Execute stealth scripts
            self.inject_stealth_scripts()
            
            self.logger.info("Successfully initialized undetected Chrome")
            
        except Exception as e:
            self.logger.error(f"Failed to setup undetected Chrome: {e}")
            self.logger.info("Falling back to regular Chrome...")
            self.setup_regular_chrome()
    
    def inject_stealth_scripts(self):
        """Inject various scripts to improve stealth"""
        if not self.driver:
            return
            
        # Basic webdriver removal
        self.driver.execute_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        """)
        
        # Add fake plugins
        self.driver.execute_script("""
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {
                        0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
                        description: "Chrome PDF Plugin",
                        filename: "internal-pdf-viewer",
                        name: "Chrome PDF Plugin",
                        length: 1
                    },
                    {
                        0: {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"},
                        description: "Chrome PDF Viewer",
                        filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                        name: "Chrome PDF Viewer",
                        length: 1
                    }
                ]
            });
        """)
        
        # Add WebGL fingerprint
        self.driver.execute_script("""
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter.apply(this, arguments);
            };
        """)
        
        # Add more realistic navigator properties
        self.driver.execute_script("""
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32'
            });
            
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: () => 8
            });
            
            Object.defineProperty(navigator, 'deviceMemory', {
                get: () => 8
            });
        """)
    
    def setup_regular_chrome(self):
        """Fallback to regular Chrome with enhanced stealth"""
        options = Options()
        
        if self.headless:
            options.add_argument("--headless")
        
        # Apply stealth configuration
        window_size = self.current_config['window_size']
        options.add_argument(f"--window-size={window_size[0]},{window_size[1]}")
        options.add_argument(f"--user-agent={self.current_config['user_agent']}")
        
        # Stealth options
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        # Additional stealth
        prefs = {
            'profile.default_content_setting_values': {
                'images': 1,  # 1 = allow, 2 = block
                'plugins': 2,
                'popups': 2,
                'geolocation': 2,
                'notifications': 2,
                'auto_select_certificate': 2,
                'fullscreen': 2,
                'mouselock': 2,
                'mixed_script': 2,
                'media_stream': 2,
                'media_stream_mic': 2,
                'media_stream_camera': 2,
                'protocol_handlers': 2,
                'ppapi_broker': 2,
                'automatic_downloads': 2,
                'midi_sysex': 2,
                'push_messaging': 2,
                'ssl_cert_decisions': 2,
                'metro_switch_to_desktop': 2,
                'protected_media_identifier': 2,
                'app_banner': 2,
                'site_engagement': 2,
                'durable_storage': 2
            }
        }
        options.add_experimental_option("prefs", prefs)
        
        self.driver = webdriver.Chrome(options=options)
        self.inject_stealth_scripts()
        
        self.logger.info("Successfully initialized regular Chrome with stealth settings")
    
    def setup_playwright(self):
        """Setup Playwright with enhanced stealth"""
        if not PLAYWRIGHT_AVAILABLE:
            self.logger.warning("Playwright not available. Install with: pip install playwright")
            return False
        
        try:
            self.playwright = sync_playwright().start()
            
            # Launch browser with stealth settings
            self.browser = self.playwright.chromium.launch(
                headless=self.headless,
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    f'--window-size={self.current_config["window_size"][0]},{self.current_config["window_size"][1]}'
                ]
            )
            
            # Create context with realistic settings
            context = self.browser.new_context(
                viewport={'width': self.current_config["window_size"][0], 
                         'height': self.current_config["window_size"][1]},
                user_agent=self.current_config["user_agent"],
                locale='en-US',
                timezone_id=self.current_config["timezone"],
                color_scheme='light',
                device_scale_factor=self.current_config["pixel_ratio"],
                permissions=['geolocation'],
                extra_http_headers={
                    'Accept-Language': self.current_config["language"],
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                }
            )
            
            # Add enhanced stealth scripts
            context.add_init_script("""
                // Remove webdriver property
                delete Object.getPrototypeOf(navigator).webdriver;
                
                // Mock plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => {
                        return {
                            0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
                            1: {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"},
                            length: 2,
                            item: function(index) { return this[index]; },
                            namedItem: function(name) { return null; }
                        };
                    }
                });
                
                // Mock languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                
                // Mock permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
                
                // Mock WebGL
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) {
                        return 'Intel Inc.';
                    }
                    if (parameter === 37446) {
                        return 'Intel Iris OpenGL Engine';
                    }
                    return getParameter.apply(this, arguments);
                };
                
                // Add other navigator properties
                Object.defineProperty(navigator, 'hardwareConcurrency', {
                    get: () => 8
                });
                
                Object.defineProperty(navigator, 'deviceMemory', {
                    get: () => 8
                });
                
                Object.defineProperty(navigator, 'platform', {
                    get: () => 'Win32'
                });
            """)
            
            self.page = context.new_page()
            self.logger.info("Successfully initialized Playwright with enhanced stealth")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to setup Playwright: {e}")
            return False
    
    def scrape_with_requests(self, url, retries=3, delay_range=(1, 3)):
        """Scrape using requests with anti-detection measures"""
        
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
                
                # Check for issues
                if response.status_code >= 400:
                    self.logger.warning(f"HTTP {response.status_code} error")
                    continue
                
                content = response.text
                page_issues = self.detect_page_issues(content)
                
                # Handle CAPTCHA
                if page_issues['captcha']['present']:
                    self.logger.warning(f"CAPTCHA detected: {page_issues['captcha']['type']}")
                    self.logger.debug(f"CAPTCHA indicators: {page_issues['captcha']['indicators']}")
                    
                    if self.captcha_solver:
                        self.logger.info("Attempting to solve CAPTCHA...")
                        solution = None
                        if page_issues['captcha']['type'] == 'recaptcha':
                            site_key = self.extract_site_key(content, 'recaptcha')
                            if site_key:
                                solution = self.captcha_solver.solve_recaptcha(site_key, url)
                        elif page_issues['captcha']['type'] == 'hcaptcha':
                            site_key = self.extract_site_key(content, 'hcaptcha')
                            if site_key:
                                solution = self.captcha_solver.solve_hcaptcha(site_key, url)
                        else:
                            self.logger.warning(f"Unsupported CAPTCHA type: {page_issues['captcha']['type']}")
                            
                        if solution:
                            self.logger.info("CAPTCHA solved, retrying request...")
                            # TODO: Implement solution submission
                            continue
                    
                    self.logger.info("Falling back to Selenium for CAPTCHA handling...")
                    if self.use_selenium:
                        return self.scrape_with_selenium(url)
                    else:
                        continue
                
                # Check for bot detection
                if page_issues['bot_detected']:
                    self.logger.warning(f"Bot detection on attempt {attempt + 1}, trying selenium...")
                    if self.use_selenium:
                        return self.scrape_with_selenium(url)
                    else:
                        continue
                
                response.raise_for_status()
                self.logger.info(f"Successfully scraped URL with requests ({len(content)} chars)")
                return content
                
            except requests.RequestException as e:
                self.logger.error(f"Request failed on attempt {attempt + 1}: {e}")
                if attempt == retries - 1:
                    raise
        
        return None
    
    def extract_site_key(self, html_content: str, captcha_type: str) -> Optional[str]:
        """Extract CAPTCHA site key from HTML content"""
        try:
            import re
            if captcha_type == 'recaptcha':
                site_key_match = re.search(r'data-sitekey="([^"]+)"', html_content)
            elif captcha_type == 'hcaptcha':
                site_key_match = re.search(r'data-sitekey="([^"]+)"', html_content)
            else:
                self.logger.error(f"Unsupported CAPTCHA type for key extraction: {captcha_type}")
                return None
                
            if not site_key_match:
                self.logger.error(f"Could not find {captcha_type} site key")
                return None
                
            return site_key_match.group(1)
            
        except Exception as e:
            self.logger.error(f"Failed to extract {captcha_type} site key: {e}")
            return None
    
    def scrape_with_selenium(self, url, wait_time=10):
        """Scrape using Selenium with human-like behavior"""
        if not self.driver:
            self.setup_selenium()
        
        if not self.driver:
            self.logger.error("Failed to setup Selenium driver")
            return None
        
        try:
            # Navigate to the page
            self.logger.info(f"Navigating to {url} with Selenium")
            self.driver.get(url)
            
            # Wait for page to load and simulate human behavior
            time.sleep(random.uniform(2, 4))
            
            # Simulate natural scrolling
            self.simulate_human_scrolling()
            
            # Wait for potential bot checks to complete
            try:
                # Wait for body to be present (page fully loaded)
                WebDriverWait(self.driver, wait_time).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                
                # Check for issues
                page_source = self.driver.page_source
                page_issues = self.detect_page_issues(page_source)
                
                if page_issues['captcha']['present']:
                    self.logger.warning(f"CAPTCHA detected: {page_issues['captcha']['type']}")
                    
                    if self.captcha_solver:
                        self.logger.info("Attempting to solve CAPTCHA...")
                        solution = None
                        if page_issues['captcha']['type'] == 'recaptcha':
                            site_key = self.extract_site_key(page_source, 'recaptcha')
                            if site_key:
                                solution = self.captcha_solver.solve_recaptcha(site_key, url)
                        elif page_issues['captcha']['type'] == 'hcaptcha':
                            site_key = self.extract_site_key(page_source, 'hcaptcha')
                            if site_key:
                                solution = self.captcha_solver.solve_hcaptcha(site_key, url)
                        else:
                            self.logger.warning(f"Unsupported CAPTCHA type: {page_issues['captcha']['type']}")
                            
                        if solution:
                            self.logger.info("CAPTCHA solved, submitting solution...")
                            # TODO: Implement solution submission
                            time.sleep(random.uniform(1, 2))
                            page_source = self.driver.page_source
                    
                elif page_issues['bot_detected']:
                    self.logger.warning("Bot detection active, waiting longer...")
                    time.sleep(random.uniform(5, 10))
                    self.simulate_human_behavior()
                    page_source = self.driver.page_source
                
                self.logger.info(f"Successfully scraped URL with Selenium ({len(page_source)} chars)")
                return page_source
                
            except TimeoutException:
                self.logger.warning("Page load timeout")
                return self.driver.page_source
                
        except Exception as e:
            self.logger.error(f"Selenium scraping failed: {e}")
            return None
    
    def simulate_human_scrolling(self):
        """Simulate natural human scrolling behavior"""
        try:
            if not self.driver:
                return
                
            # Get page height
            page_height = self.driver.execute_script("return document.body.scrollHeight")
            viewport_height = self.driver.execute_script("return window.innerHeight")
            
            # Calculate number of scroll steps
            scroll_steps = min(int(page_height / viewport_height) + 1, 5)  # Max 5 scrolls
            
            for step in range(scroll_steps):
                # Random scroll amount (50-100% of viewport)
                scroll_amount = random.uniform(0.5, 1.0) * viewport_height
                
                # Smooth scroll with random duration
                scroll_duration = random.uniform(0.5, 1.5)  # seconds
                start_time = time.time()
                
                while time.time() - start_time < scroll_duration:
                    progress = (time.time() - start_time) / scroll_duration
                    # Ease-in-out function
                    eased_progress = 0.5 * (1 - math.cos(math.pi * progress))
                    current_scroll = eased_progress * scroll_amount
                    
                    self.driver.execute_script(f"window.scrollTo(0, {current_scroll});")
                    time.sleep(0.016)  # ~60fps
                
                # Random pause between scrolls
                time.sleep(random.uniform(0.5, 2.0))
                
        except Exception as e:
            self.logger.warning(f"Failed to simulate scrolling: {e}")
    
    def simulate_human_behavior(self):
        """Simulate various human-like interactions"""
        try:
            if not self.driver:
                return
                
            # Random mouse movements
            for _ in range(random.randint(2, 5)):
                x = random.randint(100, self.current_config['window_size'][0] - 100)
                y = random.randint(100, self.current_config['window_size'][1] - 100)
                
                self.driver.execute_script(f"""
                    var evt = new MouseEvent('mousemove', {{
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: {x},
                        clientY: {y}
                    }});
                    document.dispatchEvent(evt);
                """)
                
                time.sleep(random.uniform(0.1, 0.3))
            
            # Simulate natural scrolling
            self.simulate_human_scrolling()
            
            # Random pauses
            time.sleep(random.uniform(1, 3))
            
        except Exception as e:
            self.logger.warning(f"Failed to simulate human behavior: {e}")
    
    def scrape_with_playwright(self, url, wait_time=15):
        """Scrape using Playwright with advanced stealth"""
        if not self.page:
            if not self.setup_playwright():
                return None
        
        if not self.page:
            self.logger.error("Failed to setup Playwright page")
            return None
        
        try:
            # Navigate to the page
            self.logger.info(f"Navigating to {url} with Playwright")
            response = self.page.goto(url, wait_until='networkidle', timeout=30000)
            
            # Wait for initial load
            time.sleep(random.uniform(2, 4))
            
            # Check initial response
            if response and response.status >= 400:
                self.logger.error(f"HTTP {response.status} error")
                return None
            
            # Simulate human behavior
            self.simulate_playwright_human_behavior()
            
            # Wait for any dynamic content/challenges
            try:
                # Wait for body to be stable
                self.page.wait_for_load_state('networkidle', timeout=wait_time * 1000)
                
                # Check for issues
                content = self.page.content()
                page_issues = self.detect_page_issues(content)
                
                if page_issues['captcha']['present']:
                    self.logger.warning(f"CAPTCHA detected: {page_issues['captcha']['type']}")
                    self.logger.debug(f"CAPTCHA indicators: {page_issues['captcha']['indicators']}")
                    
                    if self.captcha_solver:
                        self.logger.info("Attempting to solve CAPTCHA...")
                        solution = None
                        if page_issues['captcha']['type'] == 'recaptcha':
                            site_key = self.extract_site_key(content, 'recaptcha')
                            if site_key:
                                solution = self.captcha_solver.solve_recaptcha(site_key, url)
                        elif page_issues['captcha']['type'] == 'hcaptcha':
                            site_key = self.extract_site_key(content, 'hcaptcha')
                            if site_key:
                                solution = self.captcha_solver.solve_hcaptcha(site_key, url)
                        else:
                            self.logger.warning(f"Unsupported CAPTCHA type: {page_issues['captcha']['type']}")
                            
                        if solution:
                            self.logger.info("CAPTCHA solved, submitting solution...")
                            # TODO: Implement solution submission
                            time.sleep(random.uniform(1, 2))
                            content = self.page.content()
                        else:
                            self.logger.warning("Failed to solve CAPTCHA")
                    
                elif page_issues['bot_detected']:
                    self.logger.warning("Bot detection still active, waiting longer...")
                    time.sleep(random.uniform(5, 10))
                    self.simulate_playwright_human_behavior()
                    content = self.page.content()
                
                self.logger.info(f"Successfully scraped URL with Playwright ({len(content)} chars)")
                return content
                
            except Exception as e:
                self.logger.error(f"Playwright wait error: {e}")
                return self.page.content()
                
        except Exception as e:
            self.logger.error(f"Playwright scraping failed: {e}")
            return None
    
    def simulate_playwright_human_behavior(self):
        """Simulate human-like behavior in Playwright"""
        try:
            if not self.page:
                return
                
            # Random mouse movements
            for _ in range(random.randint(2, 5)):
                x = random.randint(100, self.current_config['window_size'][0] - 100)
                y = random.randint(100, self.current_config['window_size'][1] - 100)
                self.page.mouse.move(x, y)
                time.sleep(random.uniform(0.1, 0.3))
            
            # Scroll behavior
            page_height = self.page.evaluate('document.body.scrollHeight')
            viewport_height = self.page.evaluate('window.innerHeight')
            
            scroll_steps = min(int(page_height / viewport_height) + 1, 5)
            
            for step in range(scroll_steps):
                scroll_amount = random.uniform(0.5, 1.0) * viewport_height
                self.page.mouse.wheel(0, scroll_amount)
                time.sleep(random.uniform(0.5, 2.0))
            
            # Random pauses
            time.sleep(random.uniform(1, 3))
            
        except Exception as e:
            self.logger.warning(f"Failed to simulate Playwright human behavior: {e}")
    
    def is_bot_detected(self, html_content):
        """Check if the response indicates bot detection"""
        bot_indicators = [
            "pardon our interruption",
            "you were browsing something about your browser made us think you were a bot",
            "please make sure that cookies and javascript are enabled",
            "cloudflare",
            "checking your browser",
            "please wait",
            "security check",
            "access denied",
            "blocked",
            "ray id:",  # Cloudflare
            "why have i been blocked",
            "enable javascript and cookies",
            "browser check",
            "ddos protection",
            # Add Incapsula detection
            "incapsula",
            "incident_id",
            "request unsuccessful",
            "main-iframe",
            "_incapsula_resource",
            "swudnsai",
            "xinfo"
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
    
    def detect_page_issues(self, html_content):
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
    
    def scrape_url(self, url, method="auto", **kwargs):
        """
        Main scraping method that chooses the best approach
        
        Args:
            url: URL to scrape
            method: "requests", "selenium", "playwright", or "auto"
            **kwargs: Additional arguments
        
        Returns:
            HTML content or None if failed (for backward compatibility)
        """
        
        if method == "requests":
            content = self.scrape_with_requests(url, **kwargs)
            return content
            
        elif method == "selenium":
            content = self.scrape_with_selenium(url, **kwargs)
            return content
            
        elif method == "playwright":
            content = self.scrape_with_playwright(url, **kwargs)
            return content
            
        else:  # auto - try methods in order of stealth
            methods_to_try = ["requests"]
            
            if self.use_selenium:
                methods_to_try.append("selenium")
            if self.use_playwright:
                methods_to_try.append("playwright")
            
            for i, method_name in enumerate(methods_to_try):
                try:
                    print(f"Trying method: {method_name}")
                    
                    if method_name == "requests":
                        content = self.scrape_with_requests(url, **kwargs)
                    elif method_name == "selenium":
                        content = self.scrape_with_selenium(url, **kwargs)
                    elif method_name == "playwright":
                        content = self.scrape_with_playwright(url, **kwargs)
                    
                    if content:
                        # Check if we need to try a more advanced method
                        if self.is_bot_detected(content):
                            print(f"❌ Bot detection with {method_name}")
                            
                            # Try next method if available
                            if i < len(methods_to_try) - 1:
                                print(f"Trying next method: {methods_to_try[i+1]}")
                                continue
                            else:
                                print("All methods tried, returning current result")
                                return content
                        else:
                            print(f"✅ Success with {method_name}")
                            return content
                    else:
                        print(f"❌ {method_name} returned no content")
                        
                except Exception as e:
                    print(f"❌ {method_name} failed: {e}")
                    continue
            
            return None
    
    def scrape_multiple_urls(self, urls, delay_range=(3, 8), method="auto"):
        """
        Scrape multiple URLs with delays between requests
        
        Args:
            urls: List of URLs to scrape
            delay_range: Tuple of (min, max) delay in seconds
            method: Scraping method to use
        
        Returns:
            List of (url, html_content) tuples
        """
        results = []
        
        for i, url in enumerate(urls):
            print(f"Scraping {i+1}/{len(urls)}: {url}")
            
            # Add delay between requests (except for first one)
            if i > 0:
                delay = random.uniform(*delay_range)
                print(f"Waiting {delay:.1f} seconds...")
                time.sleep(delay)
            
            try:
                content = self.scrape_url(url, method=method)
                results.append((url, content))
                
            except Exception as e:
                print(f"Failed to scrape {url}: {e}")
                results.append((url, None))
        
        return results
    
    def close(self):
        """Clean up resources"""
        if self.driver:
            self.driver.quit()
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()
        self.session.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

# Proxy rotation class (optional enhancement)
class ProxyRotator:
    """Rotate between different proxy servers"""
    
    def __init__(self, proxy_list):
        """
        Initialize with list of proxies
        proxy_list format: ['http://proxy1:port', 'http://proxy2:port', ...]
        """
        self.proxies = proxy_list
        self.current_index = 0
    
    def get_next_proxy(self):
        """Get the next proxy in rotation"""
        if not self.proxies:
            return None
        
        proxy = self.proxies[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.proxies)
        return {'http': proxy, 'https': proxy}

# Example usage
if __name__ == "__main__":

    # Simple single URL

    # Example URLs that might have bot detection
    test_urls = [
        "https://www.deltafaucet.com/kitchen/product/9659-DST.html",
        "https://www.deltafaucet.com/kitchen/product/1165LF-AR.html",
        "https://www.deltafaucet.com/kitchen/product/9159-BL-DST"
    ]
    
    # Method 1: Using context manager
    with AntiDetectionScraper(use_selenium=True, headless=True) as scraper:
        for url in test_urls:
            print(f"\nScraping: {url}")
            content = scraper.scrape_url(url, method="auto")
            
            if content:
                if scraper.is_bot_detected(content):
                    print("❌ Still detected as bot")
                else:
                    print(f"✅ Success! Got {len(content)} characters")
                    with open(f"deltafaucet_{url.split('/')[-2]}.html", "w") as f:
                        f.write(content)
            else:
                print("❌ Failed to get content")
    
    # Method 2: Batch scraping with delays
    # print("\n" + "="*50)
    # print("BATCH SCRAPING EXAMPLE")
    # print("="*50)
    
    # with AntiDetectionScraper(use_selenium=True, headless=True) as scraper:
    #     results = scraper.scrape_multiple_urls(
    #         test_urls, 
    #         delay_range=(2, 5),
    #         method="auto"
    #     )
        
    #     for url, content in results:
    #         if content:
    #             success = not scraper.is_bot_detected(content)
    #             status = "✅ Success" if success else "❌ Bot detected"
    #             print(f"{url}: {status}")
    #         else:
    #             print(f"{url}: ❌ Failed")