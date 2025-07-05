from typing import Dict, Any

class PromptTemplator:
    """Service for creating prompts for various use cases"""
    
    @staticmethod
    def product_extraction(product_url: str, product_data: str) -> str:
        """
        Create a prompt for product data extraction
        
        Args:
            product_url (str): URL of the product page
            product_data (Dict[str, Any]): Raw product data to be included in prompt
            
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
        - qty: Quantity if specified; otherwise return "unspecified".
        - key: A unique reference key (if available).

        Return your output in this JSON format without the json tag and codeblocks.
        You **don’t add extra formatting instructions yourself**:

        ```json
        {{
        "image_url": "",
        "type": "",
        "description": "",
        "model_no": "",
        "product_link": "",
        "qty": "",
        "key": ""
        }}
        ```

        product_data:
        {product_data}
        """


if __name__ == "__main__":
    product_url = "https://www.deltafaucet.com/kitchen/product/9659-DST.html"
    product_data = {
        "title": "Delta Faucet 9659-DST",
        "metadata": {
            "description": "Delta Faucet 9659-DST",
        },
        "text": "Delta Faucet 9659-DST",
        "images": [
            {
                "src": "https://www.deltafaucet.com/kitchen/product/9659-DST.html",
                "alt": "Delta Faucet 9659-DST"
            }
        ]
    }
    prompt = PromptTemplator.product_extraction(product_url, product_data)
    print(prompt)