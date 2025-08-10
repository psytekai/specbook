# Simple Validation UI Implementation Plan

## Overview
Replace the current `verification_ui.py` with a focused two-view validation interface for direct CSV inspection of LLM extraction results.

## Key Features

### View 1: Interactive Row Validation
- **Data Table**: Display product_specs.csv in interactive table format
- **Cell-Level Rejection**: Click any cell to mark as "Reject" (turns red)
- **Row-Level Rejection**: Click row number to fail entire row
- **Validation Tracking**: Real-time counters for failed rows and field types
- **Export**: Download validation summary CSV

### View 2: Detailed Product Inspection
- **Raw HTML**: Scrollable textbox with original scraped content
- **Prompt Display**: Large textbox showing the exact prompt used
- **LLM Result**: Table view of extracted product data
- **Navigation**: Forward/back buttons through all products

## Implementation Plan

### Phase 1: Core Backend (Day 1)
Replace `verification_ui.py` with simplified structure:

**File: `simple_validation_ui.py`**
```python
from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import json
from datetime import datetime
import os
from io import StringIO

app = Flask(__name__)

# Global data storage
llm_results_df = None
product_specs_df = None
validation_state = {
    'failed_cells': {},  # {row_idx: {column: True}}
    'failed_rows': set(),
    'stats': {'total_rows': 0, 'failed_rows': 0, 'field_failures': {}}
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/load_data')
def load_data():
    # Load both CSV files
    # Return basic stats and column info

@app.route('/view1')  # Row validation view
@app.route('/view2')  # Product inspection view
@app.route('/reject_cell', methods=['POST'])
@app.route('/reject_row', methods=['POST'])
@app.route('/export_validation')
```

### Phase 2: View 1 - Row Validation Interface (Day 2)

**Frontend Template: `templates/view1.html`**
```html
<div class="validation-container">
  <div class="stats-panel">
    <h3>Validation Stats</h3>
    <div id="validation-stats">
      <p>Total Rows: <span id="total-rows">0</span></p>
      <p>Failed Rows: <span id="failed-rows">0</span></p>
      <p>Pass Rate: <span id="pass-rate">100%</span></p>
    </div>
    <div id="field-failures">
      <!-- Field-specific failure counts -->
    </div>
    <button id="export-btn">Export Validation Summary</button>
  </div>
  
  <div class="table-container">
    <table id="validation-table">
      <thead>
        <tr>
          <th>Row</th>
          <th>image_url</th>
          <th>type</th>
          <th>description</th>
          <th>model_no</th>
          <th>product_link</th>
          <th>qty</th>
        </tr>
      </thead>
      <tbody id="table-body">
        <!-- Dynamic content -->
      </tbody>
    </table>
  </div>
</div>
```

**Key JavaScript Features:**
```javascript
// Click handlers for cell rejection
$('.data-cell').click(function() {
    $(this).toggleClass('rejected');
    updateValidationStats();
});

// Row rejection handler
$('.row-header').click(function() {
    $(this).closest('tr').toggleClass('row-rejected');
    updateValidationStats();
});

// Real-time stats updates
function updateValidationStats() {
    // Count rejections, update display
    // POST to backend for state persistence
}
```

### Phase 3: View 2 - Product Inspection (Day 3)

**Frontend Template: `templates/view2.html`**
```html
<div class="inspection-container">
  <div class="navigation-panel">
    <h3>Product Inspector</h3>
    <div class="nav-controls">
      <button id="prev-btn">← Previous</button>
      <span id="current-position">1 / 100</span>
      <button id="next-btn">Next →</button>
    </div>
    <div class="product-info">
      <strong>URL:</strong> <span id="current-url"></span>
    </div>
  </div>
  
  <div class="content-panels">
    <div class="panel raw-html-panel">
      <h4>Raw HTML Content</h4>
      <textarea id="raw-html" readonly></textarea>
    </div>
    
    <div class="panel prompt-panel">
      <h4>LLM Prompt</h4>
      <textarea id="llm-prompt" readonly></textarea>
    </div>
    
    <div class="panel result-panel">
      <h4>LLM Result</h4>
      <table id="result-table">
        <tr><td>Image URL:</td><td id="result-image-url"></td></tr>
        <tr><td>Type:</td><td id="result-type"></td></tr>
        <tr><td>Description:</td><td id="result-description"></td></tr>
        <tr><td>Model No:</td><td id="result-model-no"></td></tr>
        <tr><td>Product Link:</td><td id="result-product-link"></td></tr>
        <tr><td>Quantity:</td><td id="result-qty"></td></tr>
      </table>
    </div>
  </div>
</div>
```

### Phase 4: Data Integration & Export (Day 4)

**Backend Routes:**
```python
@app.route('/load_data')
def load_data():
    global llm_results_df, product_specs_df
    llm_results_df = pd.read_csv('workspace/output/llm_results_monitored.csv')
    product_specs_df = pd.read_csv('workspace/output/product_specs_monitored.csv')
    return jsonify({
        'total_products': len(product_specs_df),
        'columns': product_specs_df.columns.tolist()
    })

@app.route('/get_product/<int:index>')
def get_product(index):
    # Return raw HTML, prompt, and LLM result for specific product
    llm_row = llm_results_df.iloc[index]
    spec_row = product_specs_df.iloc[index]
    return jsonify({
        'raw_html': llm_row['html_content'],
        'prompt': llm_row['prompt'],
        'llm_result': spec_row.to_dict(),
        'url': llm_row['product_url']
    })

@app.route('/export_validation')
def export_validation():
    # Generate validation summary CSV
    summary = {
        'total_rows': len(product_specs_df),
        'failed_rows': len(validation_state['failed_rows']),
        'pass_rate': (len(product_specs_df) - len(validation_state['failed_rows'])) / len(product_specs_df),
        'field_failures': validation_state['stats']['field_failures']
    }
    # Return CSV download
```

## File Structure
```
simple_validation_ui.py         # Main Flask app
templates/
├── base.html                   # Base template with navigation
├── index.html                  # Home page with view selection
├── view1.html                  # Row validation interface
└── view2.html                  # Product inspection interface
static/
├── css/
│   └── validation.css          # Simple, clean styling
└── js/
    └── validation.js           # Interactive functionality
```

## Key Simplifications
1. **No complex multi-model comparison** - Single data source
2. **No automated validation** - Manual reject/accept only
3. **No advanced filtering** - Simple table view
4. **No database** - CSV files + in-memory state
5. **No user accounts** - Single session validation

## Expected Workflow
1. **Start**: Load both CSV files automatically
2. **View 1**: Click through product_specs table, reject bad cells/rows
3. **View 2**: Navigate through products to inspect raw data
4. **Export**: Download validation summary with failure statistics

## Data Sources
- **LLM Results**: `workspace/output/llm_results_monitored.csv`
- **Product Specs**: `workspace/output/product_specs_monitored.csv`

## Success Criteria
- Fast, simple validation interface
- Cell-level and row-level rejection tracking
- Real-time validation statistics
- Export functionality for validation summary
- Easy navigation between raw data and extracted results

This creates a focused, simple validation tool that directly addresses core validation needs without complexity.