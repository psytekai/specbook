#!/usr/bin/env python3
"""
Electron Bridge for Specscraper - Phase 3 Implementation
Provides CLI interface for Electron app using principle-first logging architecture
"""

import sys
import json
import time
import select
from typing import Dict, Any

# Import the principle-first logging system
from lib.utils.logging_contracts import StreamSink, create_bridge_logger

# Import core modules (they'll use standard logging.getLogger())
from lib.core.scraping import StealthScraper
from lib.core.html_processor import HTMLProcessor
from lib.core.llm import PromptTemplator, LLMInvocator


class ElectronBridge:
    """Bridge between Electron app and specscraper library using principle-first logging."""

    def __init__(self):
        # Create stderr sink for structured logging
        stderr_sink = StreamSink(sys.stderr)

        # Create logger with all enhancements
        self.logger, self.stdlib_capture = create_bridge_logger(
            sink=stderr_sink,
            component="bridge",
            level="info",
            enable_rate_limiting=True,
            enable_pii_redaction=True,
            capture_stdlib_logs=True
        )

        # Initialize components lazily
        self.scraper = None
        self.processor = None
        self.templator = None
        self.llm = None
        self._initialized = False

    def initialize(self):
        """Lazy initialization of components"""
        if self._initialized:
            return

        try:
            self.logger.progress("init", 0.0, "Initializing components...")

            self.scraper = StealthScraper()
            self.processor = HTMLProcessor()
            self.templator = PromptTemplator()
            self.llm = LLMInvocator()

            self.logger.progress("init", 1.0, "Components initialized successfully")
            self._initialized = True

        except Exception as e:
            self.logger.error("Failed to initialize components", error=str(e))
            raise RuntimeError(f"Failed to initialize components: {str(e)}")

    def scrape_product(self, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Complete end-to-end product scraping pipeline"""
        start_time = time.time()

        try:
            # Initialize components if needed
            if not self._initialized:
                self.initialize()

            # Step 1: Scrape URL
            self.logger.progress("scraping", 0.15, f"Starting scrape of {url}")
            self.logger.info("Scraping URL", url=url, method=options.get("method", "auto"))

            method = options.get("method", "auto")
            scrape_result = self.scraper.scrape_url(url, method=method)

            if not scrape_result.success:
                self.logger.error("Scraping failed",
                                url=url,
                                method=scrape_result.final_method.value if scrape_result.final_method else "unknown",
                                error=scrape_result.error_reason)
                return {
                    "success": False,
                    "data": None,
                    "metadata": {
                        "scrape_method": scrape_result.final_method.value if scrape_result.final_method else "unknown",
                        "status_code": scrape_result.status_code,
                        "execution_time": time.time() - start_time
                    },
                    "error": f"Scraping failed: {scrape_result.error_reason}"
                }

            self.logger.progress("scraping", 0.5, "Page loaded successfully")
            self.logger.info("Page scraped successfully",
                           method=scrape_result.final_method.value,
                           status_code=scrape_result.status_code,
                           content_length=len(scrape_result.content) if scrape_result.content else 0)

            # Step 2: Process HTML
            self.logger.progress("processing", 0.6, "Cleaning and structuring HTML...")

            processed = self.processor.clean_html(scrape_result.content)
            processed_json = processed.model_dump_json()

            word_count = len(processed.text.split()) if processed.text else 0
            image_count = len(processed.images) if processed.images else 0

            self.logger.progress("processing", 0.7, f"HTML processed: {word_count} words, {image_count} images")
            self.logger.info("HTML processing complete",
                           word_count=word_count,
                           image_count=image_count,
                           processed_length=len(processed_json))

            # Step 3: Generate prompt and extract data
            self.logger.progress("extraction", 0.8, "Preparing LLM prompt...")

            prompt = self.templator.product_extraction(url, processed_json)
            prompt_tokens = len(prompt) // 4  # Rough estimate

            self.logger.progress("extraction", 0.85, f"Calling LLM ({options.get('llm_model', 'gpt-4o-mini')})...")
            self.logger.info("Invoking LLM",
                           model=options.get("llm_model", "gpt-4o-mini"),
                           estimated_tokens=prompt_tokens)

            llm_response = self.llm.invoke_llm(
                model_provider="openai",
                llm_model_name=options.get("llm_model", "gpt-4o-mini"),
                prompt=prompt,
                temperature=options.get("temperature", 0.7),
                max_tokens=options.get("max_tokens", 1000)
            )

            self.logger.progress("extraction", 0.95, "Parsing LLM response...")

            extracted = PromptTemplator.ProductExtractionOutput.model_validate_json(llm_response)

            self.logger.progress("complete", 1.0, "Extraction complete")
            self.logger.info("Product extraction successful",
                           extracted_type=extracted.type,
                           has_image=bool(extracted.image_url),
                           has_model_no=bool(extracted.model_no))

            execution_time = time.time() - start_time

            return {
                "success": True,
                "data": extracted.model_dump(),
                "metadata": {
                    "scrape_method": scrape_result.final_method.value,
                    "processing_time": execution_time,
                    "scrape_time": scrape_result.scrape_time,
                    "llm_model": options.get("llm_model", "gpt-4o-mini"),
                    "status_code": scrape_result.status_code,
                    "html_length": len(scrape_result.content) if scrape_result.content else 0,
                    "processed_length": len(processed_json),
                    "prompt_tokens": prompt_tokens
                },
                "error": None
            }

        except json.JSONDecodeError as e:
            self.logger.error("Failed to parse LLM response", error=str(e))
            return {
                "success": False,
                "data": None,
                "metadata": {"execution_time": time.time() - start_time},
                "error": f"Failed to parse LLM response: {str(e)}"
            }
        except Exception as e:
            self.logger.error("Scraping pipeline failed", error=str(e), error_type=type(e).__name__)
            return {
                "success": False,
                "data": None,
                "metadata": {"execution_time": time.time() - start_time},
                "error": f"{type(e).__name__}: {str(e)}"
            }


def read_stdin_with_timeout(timeout_seconds=5):
    """Read from stdin with timeout to prevent hanging"""
    if select.select([sys.stdin], [], [], timeout_seconds)[0]:
        return sys.stdin.read()
    else:
        raise TimeoutError(f"No input received within {timeout_seconds} seconds")

def main():
    """Main entry point for CLI usage"""
    try:
        # Read input from stdin with timeout
        try:
            input_raw = read_stdin_with_timeout(timeout_seconds=5)
        except TimeoutError as e:
            stderr_sink = StreamSink(sys.stderr)
            logger, _ = create_bridge_logger(stderr_sink, capture_stdlib_logs=False)
            logger.error("Input timeout",
                        error=str(e),
                        help="Pipe JSON input to this process: echo '{\"url\":\"...\"}' | electron_bridge")
            logger.flush()
            sys.stderr.flush()
            sys.exit(1)

        if not input_raw.strip():
            raise ValueError("No input provided")

        input_data = json.loads(input_raw)

        # Validate input
        if "url" not in input_data:
            raise ValueError("Missing required field: url")

        if not input_data["url"].startswith(("http://", "https://")):
            raise ValueError("Invalid URL format")

        # Create bridge and scrape
        bridge = ElectronBridge()

        # Log the start of processing
        bridge.logger.info("Processing scrape request",
                          url=input_data["url"],
                          options=input_data.get("options", {}))

        result = bridge.scrape_product(
            url=input_data["url"],
            options=input_data.get("options", {})
        )

        # Contract compliance: stdout only on success, stderr for all failures
        if result["success"]:
            # Success: exactly one JSON result to stdout (compact format)
            print(json.dumps(result))
            bridge.logger.info("Request completed successfully",
                              processing_time=result.get("metadata", {}).get("processing_time"))

            # Flush guarantees
            sys.stdout.flush()
            bridge.logger.flush()
            sys.stderr.flush()

            sys.exit(0)
        else:
            # Failure: no stdout output, error info to stderr only
            bridge.logger.error("Request failed",
                               error=result["error"],
                               metadata=result.get("metadata", {}))

            # Flush guarantees
            bridge.logger.flush()
            sys.stderr.flush()

            sys.exit(1)

    except json.JSONDecodeError as e:
        # Contract compliance: no stdout on failure, error to stderr only
        stderr_sink = StreamSink(sys.stderr)
        logger, _ = create_bridge_logger(stderr_sink, capture_stdlib_logs=False)

        logger.error("Invalid JSON input",
                    error=str(e),
                    input_preview=input_raw[:100] if 'input_raw' in locals() else "unknown")

        # Flush and exit with failure code (no stdout output)
        logger.flush()
        sys.stderr.flush()
        sys.exit(1)

    except Exception as e:
        # Contract compliance: no stdout on failure, error to stderr only
        try:
            # Try to use existing bridge logger if available
            if 'bridge' in locals() and bridge.logger:
                bridge.logger.error("Unhandled exception",
                                   error=str(e),
                                   error_type=type(e).__name__)
                bridge.logger.flush()
            else:
                # Create minimal logger for error reporting
                stderr_sink = StreamSink(sys.stderr)
                logger, _ = create_bridge_logger(stderr_sink, capture_stdlib_logs=False)
                logger.error("Bridge initialization or execution failed",
                           error=str(e),
                           error_type=type(e).__name__)
                logger.flush()

            # Flush and exit with failure code (no stdout output)
            sys.stderr.flush()
            sys.exit(1)

        except Exception:
            # Last resort: write minimal error info and exit
            try:
                sys.stderr.write(f"FATAL_ERROR: {str(e)}\n")
                sys.stderr.flush()
            except Exception:
                pass
            sys.exit(1)


if __name__ == "__main__":
    main()
