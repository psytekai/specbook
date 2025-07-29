# Product Inspector Enhancement Plan

## Overview
Transform the Product Inspector from a static view into an interactive LLM testing interface with real-time model invocation capabilities and improved result management.

## Phase 1: Backend API Enhancements

### 1.1 New Flask Endpoints
- **`/invoke_llm`** (POST): Accept model selection and prompt, return LLM response
- **`/get_models`** (GET): Return available OpenAI models from rate limiter
- **`/save_llm_result`** (POST): Store new LLM results for the current product

### 1.2 Backend Integration
- Import `LLMInvocator` and `PromptTemplator` from `lib.core.llm`
- Extract available models from `OpenAIRateLimiter.RATE_LIMITS`
- Implement error handling for LLM invocation failures
- Store LLM results in-memory with timestamps for UI display

## Phase 2: Frontend UI Restructuring  

### 2.1 Navigation Panel Changes
**Remove:**
- Status indicator section
- URL display section

**Add:**
- Model selection dropdown (populated from RATE_LIMITS)
- "Invoke LLM" button with loading states
- Error handling integration with existing error notification system

### 2.2 Results Panel Transformation
**Convert static table to:**
- Collapsible accordion-style container
- Scrollable results list (latest at top)
- Each result shows: timestamp, model used, extracted data
- Expand/collapse functionality for each result
- Clear visual hierarchy between different LLM runs

## Phase 3: Technical Implementation Details

### 3.1 Model Selection
```javascript
// Available models from OpenAIRateLimiter.RATE_LIMITS
const availableModels = [
  'gpt-3.5-turbo', 'gpt-3.5-turbo-0125', 'gpt-3.5-turbo-1106',
  'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'
]
```

### 3.2 Data Flow
1. User selects model from dropdown
2. User clicks "Invoke LLM" 
3. Frontend sends POST to `/invoke_llm` with:
   - Selected model
   - Current product's raw HTML
   - LLM prompt from text area
4. Backend uses `LLMInvocator.invoke_llm()` 
5. Response stored and returned to frontend
6. Results list updated with new entry at top

### 3.3 Error Handling
- Network errors: Show "Failed to invoke LLM" banner
- Rate limiting: Show "Rate limit exceeded, try again in X seconds"
- API errors: Show specific OpenAI error message
- Validation errors: Show "Invalid model selection" or "Empty prompt"

## Phase 4: UI/UX Considerations

### 4.1 Loading States
- Disable "Invoke LLM" button during requests
- Show spinner/loading indicator
- Display estimated wait time for rate limiting

### 4.2 Results Display
- Timestamp format: "2025-07-08 12:34:56"
- Model indicator badge
- Color coding: Green for successful extractions, Red for errors
- Collapsible by default, expand latest result automatically

### 4.3 Responsive Design
- Maintain existing responsive breakpoints
- Stack model controls on mobile
- Ensure dropdown and button remain accessible

## Phase 5: Implementation Order

1. **Backend First**: Create new endpoints and integrate LLM classes
2. **Model Integration**: Add model selection and LLM invocation logic  
3. **Frontend Updates**: Modify navigation panel and results display
4. **Error Handling**: Implement comprehensive error scenarios
5. **Testing**: Verify rate limiting, error states, and UI interactions

## Phase 6: Risk Mitigation

### 6.1 Rate Limiting
- Pre-validate model selection against available models
- Show current rate limit status in UI
- Graceful degradation when limits exceeded

### 6.2 Error Recovery
- Preserve existing results when new invocations fail
- Clear error states after successful operations
- Maintain navigation functionality during LLM operations

### 6.3 Data Consistency
- Keep results tied to specific product index
- Clear results when navigating to different product
- Maintain result history within single session

## Files to Modify

1. **`simple_validation_ui.py`**: Add new endpoints and LLM integration
2. **`templates/view2.html`**: Restructure navigation and results panels
3. **`templates/base.html`**: Ensure error notification system is available

## Dependencies Required
- Import `sys.path.append()` for lib module access
- Verify OpenAI API key availability
- Test rate limiter integration

## Implementation Notes
This plan provides a comprehensive roadmap for transforming the Product Inspector into an interactive LLM testing interface while maintaining existing functionality and following the established UI patterns.