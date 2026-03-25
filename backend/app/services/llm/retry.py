"""
Galentix AI - LLM Utilities
Retry logic, error handling, and helper utilities.
"""
import asyncio
import time
from typing import TypeVar, Callable, Optional, Any
from functools import wraps
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RetryConfig:
    """Configuration for retry behavior."""
    
    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 30.0,
        exponential_base: float = 2.0,
        retry_on_timeout: bool = True,
        retry_on_connection_error: bool = True
    ):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.retry_on_timeout = retry_on_timeout
        self.retry_on_connection_error = retry_on_connection_error


async def async_retry(
    func: Callable[..., T],
    config: Optional[RetryConfig] = None,
    *args,
    **kwargs
) -> T:
    """Async retry wrapper with exponential backoff."""
    if config is None:
        config = RetryConfig()
    
    last_exception = None
    
    for attempt in range(config.max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except asyncio.TimeoutError as e:
            last_exception = e
            if not config.retry_on_timeout or attempt >= config.max_retries:
                raise
            logger.warning(f"Timeout on attempt {attempt + 1}, retrying...")
        except (ConnectionError, ConnectionRefusedError, ConnectionResetError) as e:
            last_exception = e
            if not config.retry_on_connection_error or attempt >= config.max_retries:
                raise
            logger.warning(f"Connection error on attempt {attempt + 1}, retrying...")
        except Exception as e:
            last_exception = e
            if attempt >= config.max_retries:
                raise
            logger.warning(f"Error on attempt {attempt + 1}: {e}, retrying...")
        
        if attempt < config.max_retries:
            delay = min(
                config.initial_delay * (config.exponential_base ** attempt),
                config.max_delay
            )
            await asyncio.sleep(delay)
    
    raise last_exception


def with_retry(config: Optional[RetryConfig] = None):
    """Decorator for adding retry logic to async functions."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await async_retry(func, config, *args, **kwargs)
        return wrapper
    return decorator


class RateLimiter:
    """Simple rate limiter for API calls."""
    
    def __init__(self, max_calls: int, time_window: float):
        self.max_calls = max_calls
        self.time_window = time_window
        self._calls: list[float] = []
    
    async def acquire(self) -> None:
        """Wait until a slot is available."""
        now = time.time()
        
        self._calls = [t for t in self._calls if now - t < self.time_window]
        
        if len(self._calls) >= self.max_calls:
            oldest = self._calls[0]
            wait_time = self.time_window - (now - oldest)
            if wait_time > 0:
                await asyncio.sleep(wait_time)
                self._calls = self._calls[1:]
        
        self._calls.append(time.time())
    
    def reset(self) -> None:
        """Reset the rate limiter."""
        self._calls = []


class CircuitBreaker:
    """Circuit breaker for failing services."""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: type = Exception
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self._failure_count = 0
        self._last_failure_time: Optional[float] = None
        self._state = "closed"
    
    @property
    def state(self) -> str:
        return self._state
    
    @property
    def is_open(self) -> bool:
        if self._state == "open":
            if self._last_failure_time:
                if time.time() - self._last_failure_time > self.recovery_timeout:
                    self._state = "half-open"
                    return False
            return True
        return False
    
    def record_success(self) -> None:
        """Record a successful call."""
        self._failure_count = 0
        if self._state == "half-open":
            self._state = "closed"
    
    def record_failure(self) -> None:
        """Record a failed call."""
        self._failure_count += 1
        self._last_failure_time = time.time()
        
        if self._failure_count >= self.failure_threshold:
            self._state = "open"
            logger.warning(f"Circuit breaker opened after {self._failure_count} failures")
    
    async def call(self, func: Callable[..., T], *args, **kwargs) -> T:
        """Execute a function with circuit breaker protection."""
        if self.is_open:
            raise RuntimeError("Circuit breaker is open")
        
        try:
            result = await func(*args, **kwargs)
            self.record_success()
            return result
        except self.expected_exception as e:
            self.record_failure()
            raise


def validate_model_name(model: str) -> bool:
    """Validate model name format."""
    if not model or len(model) > 200:
        return False
    return True


def normalize_model_name(model: str) -> str:
    """Normalize model name to lowercase with hyphens."""
    return model.lower().strip().replace(" ", "-")
