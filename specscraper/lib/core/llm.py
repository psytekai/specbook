"""LLM integration module with invocation and prompt templating"""
from typing import Optional, Dict, Any
from openai import OpenAI
from dotenv import load_dotenv
import os
import logging
from pydantic import BaseModel, Field
from lib.utils.openai_rate_limiter import OpenAIRateLimiter

# Create standard logger - no configuration
logger = logging.getLogger(__name__)


class PromptTemplator:
    """Service for creating prompts for various use cases"""
    
    class ProductExtractionOutput(BaseModel):
        """Pydantic model for product extraction output"""
        image_url: str = Field(description="Direct URL to the product image")
        type: str = Field(description="The product category (e.g. range hood, grill, fireplace, etc.)")
        description: str = Field(description="Short product description, including brand, size, material, color, and notable features")
        model_no: str = Field(description="Manufacturer model number, item no, or sku no.")
        product_link: str = Field(description="Original product page URL")

    @staticmethod
    def product_extraction(product_url: str, product_data: str) -> str:
        """
        Create a prompt for product data extraction
        
        Args:
            product_url (str): URL of the product page
            product_data (str): Raw product data to be included in prompt
            
        Returns:
            str: Generated prompt for product extraction
        """

        return f"""   
<system>
    **Role & Function**
    You are an high end residential architect fetching product specification details from product websites.
    You are given a product data pulled from a website from which you will extract the relevant product information defined below.
    Clients will be reviewing the specification book, so it is important that you extract the data accurately and completely.
    
    **Product Url**
    {product_url}

    **Input Data Format**
    The input data is a dictionary with the following keys:
    - title
    - metadata
    - text
    - images

    **Data to Extract**
    - image_url
        - description: main product image URL
        - instructions 
            - If the url is a relative url, append to the base_url **without modifying the url as found in the html <img> tag**. 
            - Prioritize <img> tag urls that have attributes such as `id`, `product_id`, `product-image`, etc
        - prioritization_rules:
            - Open Graph image (og:image meta tag)
            - Images with IDs containing: product, main, hero, primary
            - First image in a product gallery
            - Largest image by dimensions in content area
            - Image referenced in structured data
        - validation:
            - Must be absolute URL or properly resolved relative URL
            - Prefer high-resolution versions when available
            - Avoid thumbnails (check for "thumb", "small" in URL)
    - type
        - description: The product category
        - examples
            - "range hood"
            - "grill"
            - "fireplace"
    - description
        - formatting_rules:
            - Line 1: Manufacturer/Brand name
            - Line 2: Product line or model name
            - Line 3: Distinguishing features (color, size, finish)
            - Line 4+: Additional specifications if critical
        - length: Maximum 4 lines, prefer 2-3
        - style: Use title case for proper nouns, no periods
        - paint_specific_template:
            "Paint\nMFR: {{manufacturer}}\nColor: {{color_code}} {{color_name}}\nSheen: {{sheen_type}}"
        - examples
            - "Kwikset\nMilan Round\nMatte Black"
            - "Drywall Finish Level 4 Smooth\nMFR: Dunn Edwards\nColor:DEW340 Whisper\nSheen: Flat\nNote: Ceiling Finish"
            - "Fireclay\n2x2 Sheeted\nBasalt"
            - "Delta\nTrinsic - Single handle pull-down faucet\nMatte Black"
            - "BainUltra\nNokori Oval 6737"
            - "Kohler\nElmbrook\nWhite"
            - "Nuvo Lighting\nBlink Plus LED 7 inch White Flush Mount Ceiling Light\nWhite"
            - "DWR\nMondrian Mirror 22x44"
            - "Wolf\nBlack\n30\" M Series Contemporary Built-In Double Oven"
            - "Fireorb\nFireorb\nBlack"
    - model_no
        - description: Manufacturer model number, item no, or sku no.
        - instructions
            - If the model number is not found, return ""
        - validation:
            - Remove extra whitespace
            - Preserve original formatting (hyphens, spaces)
            - Include full code (prefix + number)
    - product_link
        - description: Original product page URL defined in the `**Product Url**` section.
    
    ```
    **Output Format**
    1. Extract the following data in JSON format from <product_data>
    2. Return your output in this JSON format without the json tag and codeblocks
    3. You **don't add extra formatting instructions yourself**

    ```json
    {{
    "image_url": "",
    "type": "",
    "description": "",
    "model_no": "",
    "product_link": ""
    }}
    ```

    **IMPORTANT**:
    1. If you are not 99.9% sure that the information is accurate, return "" for the value.
</system>

<product_data>
{product_data}
</product_data>
        """

    @staticmethod
    def product_extraction_v1(product_url: str, product_data: str) -> str:
        """
        Create a prompt for product data extraction
        
        Args:
            product_url (str): URL of the product page
            product_data (str): Raw product data to be included in prompt
            
        Returns:
            str: Generated prompt for product extraction
        """

        return f"""
        System:
        You are a project architect tasked with fetching specification details from the following product website's HTML page. Extract the relevant product information for documentation in a specification book.

        If you are not 99.9% sure that the information is correct, return the value with the highest probability, including the probability in the value field.

        TITLE:
        product_data['title']

        PRODUCT URL:
        {product_url}

        METADATA:
        product_data['metadata']

        TEXT CONTENT:
        product_data['text']

        IMAGES:
        product_data['images']

        Extract the following structured data in JSON format from the provided product web page:

        - image_url: Direct URL to the product image. If the url is a relative url, append to the base_url **without modifying the url as found in the html <img> tag**. Prioritize <img> tag urls that have an `id` attribute or any attribute with a value that relates it to the main product image.
        - type: The product category (e.g. range hood, grill, fireplace, etc.).
        - description: Short product description, including brand, size, material, color, and any notable features
        - model_no: Manufacturer model number, item no, or sku no.
        - product_link: Original product page URL.

        Return your output in this JSON format without the json tag and codeblocks.
        You **don't add extra formatting instructions yourself**:

        ```json
        {{
        "image_url": "",
        "type": "",
        "description": "",
        "model_no": "",
        "product_link": ""
        }}
        ```

        product_data:
        {product_data}
        """


class LLMInvocator:
    """Service for invoking LLM models with rate limiting"""

    def __init__(self):
        load_dotenv()

        if os.getenv("OPENAI_API_KEY") is None:
            raise ValueError("OPENAI_API_KEY is not set")
        
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.rate_limiter = OpenAIRateLimiter()
        
        logger.info("Initialized LLMInvocator with rate limiting")

    def invoke_llm(
        self,
        model_provider: str,
        llm_model_name: str,
        prompt: str,
        temperature: Optional[float] = 0.7,
        max_tokens: Optional[int] = 1000
    ) -> str:
        """
        Invoke an LLM model and get response with rate limiting
        
        Args:
            model_provider (str): Provider of the LLM (e.g., 'openai', 'anthropic')
            llm_model_name (str): Name of the specific model to use
            prompt (str): Input prompt for the LLM
            temperature (float, optional): Sampling temperature. Defaults to 0.7
            max_tokens (int, optional): Maximum tokens in response. Defaults to 1000
            
        Returns:
            str: LLM response text
        """
        if model_provider.lower() != "openai":
            raise ValueError(f"Unsupported model provider: {model_provider}")
        
        # Estimate tokens (rough approximation: 1 token ≈ 4 characters)
        estimated_input_tokens = len(prompt) // 4
        estimated_output_tokens = max_tokens or 1000
        estimated_total_tokens = estimated_input_tokens + estimated_output_tokens
        
        # Acquire rate limit permission
        self.rate_limiter.acquire(llm_model_name, estimated_total_tokens)
        
        try:
            logger.info(f"Making OpenAI API call to {llm_model_name}")
            response = self.client.chat.completions.create(
                model=llm_model_name,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            # Update with actual token usage
            actual_tokens = response.usage.total_tokens if response.usage else 0
            self.rate_limiter.update_actual_tokens(llm_model_name, actual_tokens, estimated_total_tokens)
            
            logger.info(f"OpenAI API call successful. Used {actual_tokens} tokens")
            return response.choices[0].message.content if response.choices[0].message.content else ""
            
        except Exception as e:
            logger.error(f"OpenAI API call failed: {str(e)}")
            raise

    def get_usage_stats(self, model: str = '') -> dict:
        """
        Get current rate limit usage statistics
        
        Args:
            model (str, optional): Specific model to get stats for. If None, returns stats for all models.
            
        Returns:
            dict: Usage statistics
        """
        if model:
            return self.rate_limiter.get_usage_stats(model)
        else:
            # Return stats for all models that have been used
            all_stats = {}
            for model_name in self.rate_limiter.current_requests.keys():
                all_stats[model_name] = self.rate_limiter.get_usage_stats(model_name)
            return all_stats