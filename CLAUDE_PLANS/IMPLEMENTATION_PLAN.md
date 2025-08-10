# Specbook Pipeline Improvements Implementation Plan

## Overview
This document outlines the implementation plan for addressing two key issues in the `specbook_monitored.py` pipeline:

1. **Filter Failed Fetches**: The `product_specs_monitored.csv` output should exclude data for failed fetches, except for the `description` field which should contain error information
2. **Remove Unused Fields**: Remove `qty` and `key` columns from the output schema

## Current Architecture Analysis

### Data Flow
```
Input CSV → Scraping → HTML Processing → LLM Extraction → Product Specs CSV
```

### Key Components
- **ProductExtractionOutput Model**: Defines the output schema (currently includes qty/key fields)
- **Scraping Phase**: Creates records with success/failure status and error details
- **LLM Phase**: Processes only successful scrapes, creates default responses for failures
- **Output Phase**: Converts all LLM responses to product specs CSV

## Issues Identified

### Issue 1: Failed Fetches in Output
**Location**: `specbook_monitored.py:213-216`
```python
# Current problematic code
llm_result_dicts = [dict(PromptTemplator.ProductExtractionOutput.model_validate_json(response)) 
                   for response in llm_results_df['llm_response'].to_list()]
product_specs_df = pd.DataFrame(llm_result_dicts)
```

**Problem**: All rows are included in output, even failed fetches with empty/default values.

### Issue 2: Unused Fields
**Location**: `/lib/core/llm.py:16` (ProductExtractionOutput model)
```python
# Fields to remove
qty: str = Field(description="Quantity if specified; otherwise 'unspecified'")
key: str = Field(description="A unique reference key (if available)")
```

## Implementation Plan

### Step 1: Update ProductExtractionOutput Model
**File**: `/lib/core/llm.py`
**Line**: ~16-30

**Changes**:
- Remove `qty` field and its Field definition
- Remove `key` field and its Field definition

**New Model Structure**:
```python
class ProductExtractionOutput(BaseModel):
    image_url: str = Field(description="Direct URL to the product image")
    type: str = Field(description="The product category (e.g. range hood, grill, fireplace, etc.)")
    description: str = Field(description="Short product description, including brand, size, material, color, and notable features")
    model_no: str = Field(description="Manufacturer model number, item no, or sku no.")
    product_link: str = Field(description="Original product page URL")
```

### Step 2: Update Default Response Creation
**File**: `workspace/scripts/specbook_monitored.py`
**Lines**: 152-160

**Changes**:
- Remove `qty=""` and `key=""` from default_response initialization

**New Code**:
```python
default_response = PromptTemplator.ProductExtractionOutput(
    image_url="",
    type="",
    description="",
    model_no="",
    product_link="",
)
```

### Step 3: Enhanced Error Handling for Failed Scrapes
**File**: `workspace/scripts/specbook_monitored.py`
**Lines**: 151-202 (LLM processing loop)

**Changes**:
- For failed scrapes (`success == False`), populate description with error details
- Format error message to include status code and error reason

**New Logic**:
```python
if success == True and pd.notna(prompt):
    # Existing LLM processing logic
else:
    # For failed scrapes, populate description with error info
    row_data = llm_results_df[llm_results_df['id'] == id].iloc[0]
    status_code = row_data.get('status_code', 'Unknown')
    error_reason = row_data.get('error_reason', 'Unknown error')
    default_response.description = f"FETCH_FAILED: Status {status_code} - {error_reason}"
```

### Step 4: Filter Product Specs Output
**File**: `workspace/scripts/specbook_monitored.py`
**Lines**: 213-216

**Changes**:
- Create filtered DataFrame that only includes successful extractions
- For failed scrapes, create minimal records with only description field populated
- Combine successful and failed records appropriately

**New Logic**:
```python
# Separate successful and failed results
successful_results = []
failed_results = []

for i, (response, success) in enumerate(zip(llm_results_df['llm_response'], llm_results_df['success'])):
    result_dict = dict(PromptTemplator.ProductExtractionOutput.model_validate_json(response))
    
    if success:
        successful_results.append(result_dict)
    else:
        # Only include description for failed fetches
        failed_results.append({
            'image_url': '',
            'type': '',
            'description': result_dict['description'],  # Contains error info
            'model_no': '',
            'product_link': ''
        })

# Combine results
all_results = successful_results + failed_results
product_specs_df = pd.DataFrame(all_results)
```

## Testing Strategy

### Pre-Implementation Testing
1. **Verify Current Behavior**:
   - Run pipeline with test data containing failed URLs
   - Document current output structure
   - Identify failed fetch entries in current CSV

### Post-Implementation Testing
1. **Model Validation**:
   - Verify ProductExtractionOutput model accepts new structure
   - Test with sample JSON data
   - Confirm no qty/key fields present

2. **Pipeline Testing**:
   - Run with mixed success/failure test data
   - Verify failed fetches only have description field populated
   - Confirm successful extractions have all fields
   - Validate error message format in description field

3. **Output Validation**:
   - Check CSV structure matches expectations
   - Verify no empty rows for failed fetches (except description)
   - Confirm error information is properly captured

## Risk Assessment

### Low Risk Changes
- Removing unused fields from model (qty, key)
- Updating default response creation

### Medium Risk Changes
- Modifying output filtering logic
- Error message formatting

### Mitigation Strategies
- Create backup of current pipeline before changes
- Test with small dataset first
- Implement changes incrementally
- Validate each step before proceeding

## Success Criteria

1. **Field Removal**: No `qty` or `key` columns in output CSV
2. **Error Handling**: Failed fetches only have description field with error details
3. **Data Integrity**: Successful extractions remain unchanged
4. **Error Format**: Description field shows "FETCH_FAILED: Status {code} - {reason}"
5. **No Regression**: Existing functionality remains intact

## Implementation Order

1. Update ProductExtractionOutput model (lowest risk)
2. Update default response creation (low risk)
3. Enhance error handling logic (medium risk)
4. Modify output filtering (medium risk)
5. Test complete pipeline (validation)

Each step should be tested before proceeding to the next to ensure stability and correctness.