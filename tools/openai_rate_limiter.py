import time
import threading
from typing import Dict, Any
from dataclasses import dataclass
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

@dataclass
class RateLimit:
    """Rate limit configuration for a specific model"""
    requests_per_minute: int
    tokens_per_minute: int
    requests_per_day: int
    batch_queue_limit: int

class OpenAIRateLimiter:
    """
    Thread-safe rate limiter for OpenAI API calls
    
    Based on OpenAI's actual rate limits as shown in the platform settings.
    Handles concurrent requests while respecting both request and token limits.
    """
    
    # Rate limits from OpenAI platform settings
    RATE_LIMITS = {
        # GPT-3.5 models
        "gpt-3.5-turbo": RateLimit(500, 200000, 10000, 2000000),
        "gpt-3.5-turbo-0125": RateLimit(500, 200000, 10000, 2000000),
        "gpt-3.5-turbo-1106": RateLimit(500, 200000, 10000, 2000000),
        "gpt-3.5-turbo-16k": RateLimit(500, 200000, 10000, 2000000),
        "gpt-3.5-turbo-instruct": RateLimit(3500, 90000, 10000, 200000),
        "gpt-3.5-turbo-instruct-0914": RateLimit(3500, 90000, 10000, 200000),
        
        # GPT-4 models
        "gpt-4": RateLimit(500, 10000, 10000, 100000),
        "gpt-4-0613": RateLimit(500, 10000, 10000, 100000),
        "gpt-4-turbo": RateLimit(500, 30000, 10000, 90000),
        "gpt-4-turbo-2024-04-09": RateLimit(500, 30000, 10000, 90000),
        "gpt-4-turbo-preview": RateLimit(500, 30000, 10000, 90000),
        "gpt-4-0125-preview": RateLimit(500, 30000, 10000, 90000),
        "gpt-4-1106-preview": RateLimit(500, 30000, 10000, 90000),
        "gpt-4.1": RateLimit(500, 30000, 10000, 900000),
        "gpt-4.1-2025-04-14": RateLimit(500, 30000, 10000, 900000),
        
        # Default fallback
        "default": RateLimit(500, 10000, 10000, 100000)
    }
    
    def __init__(self):
        """Initialize the rate limiter"""
        self.lock = threading.Lock()
        
        # Track requests and tokens per model
        self.request_history: Dict[str, list] = defaultdict(list)
        self.token_history: Dict[str, list] = defaultdict(list)
        
        # Current usage counters
        self.current_requests: Dict[str, int] = defaultdict(int)
        self.current_tokens: Dict[str, int] = defaultdict(int)
        
        logger.info("Initialized OpenAI rate limiter with platform limits")
    
    def _get_rate_limit(self, model: str) -> RateLimit:
        """Get rate limit configuration for a model"""
        return self.RATE_LIMITS.get(model, self.RATE_LIMITS["default"])
    
    def _clean_old_entries(self, model: str, current_time: float) -> None:
        """Remove entries older than 60 seconds"""
        cutoff_time = current_time - 60
        
        # Clean request history
        self.request_history[model] = [
            timestamp for timestamp in self.request_history[model]
            if timestamp > cutoff_time
        ]
        
        # Clean token history  
        self.token_history[model] = [
            (timestamp, tokens) for timestamp, tokens in self.token_history[model]
            if timestamp > cutoff_time
        ]
        
        # Update current counters
        self.current_requests[model] = len(self.request_history[model])
        self.current_tokens[model] = sum(
            tokens for _, tokens in self.token_history[model]
        )
    
    def _calculate_wait_time(self, model: str, estimated_tokens: int) -> float:
        """Calculate how long to wait before making the request"""
        rate_limit = self._get_rate_limit(model)
        current_time = time.time()
        
        # Clean old entries
        self._clean_old_entries(model, current_time)
        
        wait_times = []
        
        # Check RPM limit
        if self.current_requests[model] >= rate_limit.requests_per_minute:
            oldest_request = min(self.request_history[model])
            wait_time_rpm = 60 - (current_time - oldest_request)
            if wait_time_rpm > 0:
                wait_times.append(wait_time_rpm)
        
        # Check TPM limit
        if self.current_tokens[model] + estimated_tokens > rate_limit.tokens_per_minute:
            if self.token_history[model]:
                # Find when we'll have enough token budget
                needed_tokens = (self.current_tokens[model] + estimated_tokens) - rate_limit.tokens_per_minute
                
                # Sort by timestamp to find oldest tokens that need to expire
                sorted_tokens = sorted(self.token_history[model], key=lambda x: x[0])
                tokens_to_expire = 0
                
                for timestamp, tokens in sorted_tokens:
                    tokens_to_expire += tokens
                    if tokens_to_expire >= needed_tokens:
                        wait_time_tpm = 60 - (current_time - timestamp)
                        if wait_time_tpm > 0:
                            wait_times.append(wait_time_tpm)
                        break
        
        return max(wait_times) if wait_times else 0
    
    def acquire(self, model: str, estimated_tokens: int) -> None:
        """
        Acquire permission to make an API call
        
        Args:
            model: The OpenAI model name
            estimated_tokens: Estimated tokens for the request (input + expected output)
        """
        with self.lock:
            wait_time = self._calculate_wait_time(model, estimated_tokens)
            
            if wait_time > 0:
                logger.info(f"Rate limit reached for {model}. Waiting {wait_time:.2f} seconds...")
                time.sleep(wait_time)
                # Recalculate after waiting
                self._clean_old_entries(model, time.time())
            
            # Record the request
            current_time = time.time()
            self.request_history[model].append(current_time)
            self.token_history[model].append((current_time, estimated_tokens))
            
            # Update counters
            self.current_requests[model] += 1
            self.current_tokens[model] += estimated_tokens
            
            rate_limit = self._get_rate_limit(model)
            logger.debug(f"Acquired rate limit for {model}: "
                        f"requests={self.current_requests[model]}/{rate_limit.requests_per_minute}, "
                        f"tokens={self.current_tokens[model]}/{rate_limit.tokens_per_minute}")
    
    def update_actual_tokens(self, model: str, actual_tokens: int, estimated_tokens: int) -> None:
        """
        Update token usage with actual consumption
        
        Args:
            model: The OpenAI model name
            actual_tokens: Actual tokens consumed
            estimated_tokens: Previously estimated tokens
        """
        with self.lock:
            # Find and update the most recent token entry
            if self.token_history[model]:
                # Update the most recent entry
                last_entry = self.token_history[model][-1]
                timestamp = last_entry[0]
                self.token_history[model][-1] = (timestamp, actual_tokens)
                
                # Update current counter
                self.current_tokens[model] = self.current_tokens[model] - estimated_tokens + actual_tokens
                
                logger.debug(f"Updated token usage for {model}: "
                           f"estimated={estimated_tokens}, actual={actual_tokens}")
    
    def get_usage_stats(self, model: str) -> Dict[str, Any]:
        """Get current usage statistics for a model"""
        with self.lock:
            current_time = time.time()
            self._clean_old_entries(model, current_time)
            
            rate_limit = self._get_rate_limit(model)
            
            return {
                "model": model,
                "current_requests": self.current_requests[model],
                "max_requests": rate_limit.requests_per_minute,
                "current_tokens": self.current_tokens[model],
                "max_tokens": rate_limit.tokens_per_minute,
                "request_utilization": self.current_requests[model] / rate_limit.requests_per_minute,
                "token_utilization": self.current_tokens[model] / rate_limit.tokens_per_minute
            }
    
    def set_custom_limits(self, model: str, requests_per_minute: int, tokens_per_minute: int, 
                         requests_per_day: int = 10000, batch_queue_limit: int = 100000) -> None:
        """Set custom rate limits for a specific model"""
        self.RATE_LIMITS[model] = RateLimit(
            requests_per_minute=requests_per_minute,
            tokens_per_minute=tokens_per_minute,
            requests_per_day=requests_per_day,
            batch_queue_limit=batch_queue_limit
        )
        
        logger.info(f"Set custom limits for {model}: "
                   f"RPM={requests_per_minute}, TPM={tokens_per_minute}")