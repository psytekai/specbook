from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv
import os
import logging
from .openai_rate_limiter import OpenAIRateLimiter

logger = logging.getLogger(__name__)


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


if __name__ == "__main__":
    llm_invocator = LLMInvocator()
    prompt = "What is the capital of France?"
    response = llm_invocator.invoke_llm("openai", "gpt-4o", prompt)
    print(response)
    print("\nUsage stats:")
    print(llm_invocator.get_usage_stats())