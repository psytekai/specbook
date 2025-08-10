# LLM Product Data Extraction Prompt Improvement Guide

## Executive Summary
This document provides detailed suggestions for improving the LLM data extraction prompt used for product specification gathering. Each suggestion includes rationale and real examples demonstrating the improvement.

## Current Prompt Strengths
- Clear role definition and context
- Well-structured input/output specifications
- Good examples for the description field
- Sensible fallback for uncertain data ("I don't know")

## Critical Improvements

### 1. Add Structured Reasoning Steps

**Issue**: The prompt lacks explicit reasoning steps, which can lead to inconsistent extraction logic.

**Improvement**: Add a "Step-by-Step Process" section:

```xml
**Step-by-Step Process**
1. First, identify the product category by looking for:
   - Category breadcrumbs
   - Navigation paths
   - Product type keywords in title/description
   
2. Locate the primary product image by checking:
   - Open Graph meta tags (og:image)
   - Images with product-related IDs or classes
   - Largest image in the content area
   
3. Extract model/SKU information from:
   - Structured data fields
   - Product specifications tables
   - Text patterns like "Model:", "SKU:", "Item #:"
   
4. Compose the description using this hierarchy:
   - Manufacturer name
   - Product line/series
   - Specific model name
   - Key distinguishing features (color, size, finish)
```

### 2. Enhanced Product Type Classification

**Issue**: Current type examples are limited and don't cover the paint product shown in the example.

**Improvement**: Add comprehensive type taxonomy:

```xml
- type
    - description: The product category
    - taxonomy:
        - "paint" (for paint colors, finishes)
        - "hardware" (door handles, locks, hinges)
        - "plumbing" (faucets, sinks, toilets)
        - "lighting" (fixtures, bulbs, switches)
        - "appliances" (ovens, refrigerators, dishwashers)
        - "surfaces" (tile, countertops, flooring)
        - "furniture" (built-ins, vanities, mirrors)
    - extraction_hints:
        - Look for category breadcrumbs
        - Check URL path segments
        - Identify category-specific keywords
```

### 3. Context-Aware Image Selection

**Issue**: Current image selection rules are too generic.

**Improvement**: Add intelligent image prioritization:

```xml
- image_url
    - description: main product image URL
    - prioritization_rules:
        1. Open Graph image (og:image meta tag)
        2. Images with IDs containing: product, main, hero, primary
        3. First image in a product gallery
        4. Largest image by dimensions in content area
        5. Image referenced in structured data
    - validation:
        - Must be absolute URL or properly resolved relative URL
        - Prefer high-resolution versions when available
        - Avoid thumbnails (check for "thumb", "small" in URL)
```

### 4. Model Number Extraction Strategy

**Issue**: Limited guidance on finding model numbers in various formats.

**Improvement**: Add comprehensive extraction patterns:

```xml
- model_no
    - description: Manufacturer model number, item no, or sku no.
    - extraction_patterns:
        - Look for labels: "Model:", "Item #:", "SKU:", "Product Code:"
        - Check structured data/microdata
        - Search specification tables
        - Extract from URL parameters (e.g., ?sku=, /product/)
        - For paint: color codes (e.g., "DEW340")
    - validation:
        - Remove extra whitespace
        - Preserve original formatting (hyphens, spaces)
        - Include full code (prefix + number)
```

### 5. Description Formatting Rules

**Issue**: Description examples show formatting but no explicit rules.

**Improvement**: Add clear formatting guidelines:

```xml
- description
    - formatting_rules:
        - Line 1: Manufacturer/Brand name
        - Line 2: Product line or model name
        - Line 3: Distinguishing features (color, size, finish)
        - Line 4+: Additional specifications if critical
    - length: Maximum 4 lines, prefer 2-3
    - style: Use title case for proper nouns, no periods
    - paint_specific_template:
        "Paint\nMFR: {manufacturer}\nColor: {color_code} {color_name}\nSheen: {sheen_type}"
```

### 6. Validation and Confidence Checks

**Issue**: No explicit validation steps beyond the "99.9% sure" rule.

**Improvement**: Add validation checklist:

```xml
**Validation Checklist**
Before finalizing output, verify:
□ image_url resolves to an actual image (not placeholder)
□ type matches one of the defined categories
□ description follows the formatting template
□ model_no is alphanumeric (no marketing text)
□ product_link matches the original URL exactly

**Confidence Scoring**
Rate your confidence for each field:
- HIGH: Information explicitly stated
- MEDIUM: Information inferred from context
- LOW: Best guess based on patterns

Only return "I don't know" for LOW confidence extractions.
```

### 7. Edge Case Handling

**Issue**: No guidance for common edge cases.

**Improvement**: Add specific edge case instructions:

```xml
**Edge Case Handling**
- Multiple products on page: Extract only the primary/featured product
- Color/size variants: Extract the default or first variant
- Bundle products: Focus on the main item, not accessories
- Discontinued products: Still extract all available information
- Missing images: Use placeholder or brand logo if no product image
- Dynamic content: Work with the static HTML provided
```

## Example: Improved Paint Product Extraction

Using the Dunn-Edwards Whisper paint example:

### Current Approach Issues:
- Might miss that this is a "paint" product
- Could select wrong image from multiple options
- Model number extraction might miss "DEW340"

### With Improvements Applied:

```json
{
  "image_url": "https://h6a8m2f3.delivery.rocketcdn.me/wp-content/uploads/2023/06/DEW340.jpg",
  "type": "paint",
  "description": "Paint\nMFR: Dunn-Edwards\nColor: DEW340 Whisper\nSheen: Not specified",
  "model_no": "DEW340",
  "product_link": "https://www.dunnedwards.com/colors/browser/dew340"
}
```

**Reasoning Applied**:
1. Identified "paint" type from URL path "/colors/" and content
2. Selected og:image as primary product image
3. Extracted color code from multiple locations (URL, text)
4. Formatted description using paint-specific template
5. Validated all fields meet requirements

## Implementation Recommendations

1. **Test with diverse products**: Include paints, hardware, appliances, and edge cases
2. **Create field-specific validators**: Ensure each extracted field meets format requirements
3. **Add confidence scoring**: Help identify when human review is needed
4. **Version control prompts**: Track changes and their impact on extraction quality
5. **Build a feedback loop**: Collect extraction errors to refine prompt further

## Metrics to Track

- **Extraction accuracy**: Percentage of correctly extracted fields
- **Confidence distribution**: How often the model returns "I don't know"
- **Processing time**: Impact of additional instructions on response time
- **Error patterns**: Common failure modes to address in future iterations