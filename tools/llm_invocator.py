from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv
import os


class LLMInvocator:
    """Service for invoking LLM models"""

    def __init__(self):
        load_dotenv()


        if os.getenv("OPENAI_API_KEY") is None:
            raise ValueError("OPENAI_API_KEY is not set")

    def invoke_llm(
        self,
        model_provider: str,
        llm_model_name: str,
        prompt: str,
        temperature: Optional[float] = 0.7,
        max_tokens: Optional[int] = 1000
    ) -> str:
        """
        Invoke an LLM model and get response
        
        Args:
            model_provider (str): Provider of the LLM (e.g., 'openai', 'anthropic')
            llm_model_name (str): Name of the specific model to use
            prompt (str): Input prompt for the LLM
            temperature (float, optional): Sampling temperature. Defaults to 0.7
            max_tokens (int, optional): Maximum tokens in response. Defaults to 1000
            
        Returns:
            str: LLM response text
        """
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = client.responses.create(
            model=llm_model_name,
            input=prompt
        )
        return response.output_text


if __name__ == "__main__":
    llm_invocator = LLMInvocator()
    prompt = "What is the capital of France?"
    response = llm_invocator.invoke_llm("openai", "gpt-4.1", prompt)
    print(response)