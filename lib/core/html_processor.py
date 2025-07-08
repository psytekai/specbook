from pydantic import BaseModel
from typing import List, Dict, Optional
from bs4 import BeautifulSoup


class ImgTag(BaseModel):
    """Pydantic model for image tag"""
    src: str
    alt: str

class ProcessedHTML(BaseModel):
    """Pydantic model for processed HTML content"""
    title: str
    metadata: Dict[str, str]
    text: str
    images: List[ImgTag]


class HTMLProcessor:
    """Service for processing raw HTML content"""
    
    @staticmethod
    def clean_html(raw_html: str) -> ProcessedHTML:
        """
        Process raw HTML string and extract structured content
        
        Args:
            raw_html (str): Raw HTML content to process
            
        Returns:
            ProcessedHTML: Processed HTML content in structured format
        """
        soup = BeautifulSoup(raw_html, "html.parser")

        REMOVE_TAGS = [
            "script", "style", "noscript", "svg", "footer", "header",
            "nav", "form", "iframe", "aside", "canvas", "button", "input", "select", "option"
        ]

        GARBAGE_KEYWORDS = ["cookie", "newsletter", "subscribe", "banner", "social", "share", "advert"]

        preprocessed_html = {}


        # Remove noise tags
        for tag in soup(REMOVE_TAGS):
            tag.decompose()

        # # Remove elements with garbage classes/ids
        # for el in soup.find_all(attrs={"class": True}):
        #     cls = " ".join(el.get("class"))
        #     if any(kw in cls.lower() for kw in GARBAGE_KEYWORDS):
        #         el.decompose()
        #
        # for el in soup.find_all(attrs={"id": True}):
        #     id_ = el.get("id")
        #     if id_ and any(kw in id_.lower() for kw in GARBAGE_KEYWORDS):
        #         el.decompose()

        # Extract visible text
        text = soup.get_text(separator="\n", strip=True)
        text_lines = [line.strip() for line in text.splitlines() if line.strip()]
        visible_text = "\n".join(text_lines)

        # Extract metadata
        metadata = {
            (tag.get("property") or tag.get("name")) or "unknown": str(tag.get("content"))
            for tag in soup.find_all("meta")
            if tag.get("content")
        }

        # Extract images with alt text
        images = []
        for img in soup.find_all("img"):
            src = img.get("src")
            alt = img.get("alt", "").strip()
            if src:
                images.append({"src": src, "alt": alt})

        return ProcessedHTML(
            title=soup.title.string.strip() if soup.title and soup.title.string else "",
            metadata=metadata,
            text=visible_text,
            images=images
        )

if __name__ == '__main__':
    test_html = """
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="description" content="A sample HTML page with basic elements.">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample Product Page</title>
</head>
<body>
    <h1>Welcome to Our Product Page</h1>
    <p>This is a simple example showing basic HTML structure.</p>
    <img src="https://via.placeholder.com/300" alt="Sample Product Image">
</body>
</html>
    """
    cleaned_html = HTMLProcessor.clean_html(test_html)
    print(cleaned_html.model_dump_json())