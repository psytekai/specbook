#!/usr/bin/env python3
"""
Simple Validation UI for LLM Extraction Results

A focused two-view validation interface for manual inspection of product extraction results.
"""
from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import json
from datetime import datetime
import os
from io import StringIO
import numpy as np
import sys
import traceback

# Add lib directory to path for imports
lib_path = os.path.join(os.path.dirname(__file__), 'lib')
sys.path.insert(0, lib_path)

try:
    import core.llm as llm_module
    import utils.openai_rate_limiter as rate_limiter_module
    
    LLMInvocator = llm_module.LLMInvocator
    PromptTemplator = llm_module.PromptTemplator
    OpenAIRateLimiter = rate_limiter_module.OpenAIRateLimiter
    print("✓ LLM components imported successfully")
except ImportError as e:
    print(f"Warning: Could not import LLM modules: {e}")
    LLMInvocator = None
    PromptTemplator = None
    OpenAIRateLimiter = None

app = Flask(__name__)

# Global data storage
llm_results_df = None
product_specs_df = None
validation_state = {
    'failed_cells': {},  # {row_idx: {column: True}}
    'failed_rows': set(),
    'stats': {'total_rows': 0, 'failed_rows': 0, 'field_failures': {}}
}

# LLM integration storage and instances
llm_invocator = None
llm_results_history = {}  # {product_index: [{"timestamp": "", "model": "", "result": {}, "error": ""}]}

# Initialize LLM components
def init_llm_components():
    global llm_invocator
    if LLMInvocator is not None:
        try:
            llm_invocator = LLMInvocator()
            print("LLM components initialized successfully")
        except Exception as e:
            print(f"Failed to initialize LLM components: {e}")
            llm_invocator = None
    else:
        print("LLM components not available")

# Initialize on startup
init_llm_components()

@app.route('/')
def index():
    """Home page with view selection"""
    return render_template('index.html')

@app.route('/load_data')
def load_data():
    """Load both CSV files and return basic stats"""
    global llm_results_df, product_specs_df, validation_state
    
    try:
        # Load CSV files
        llm_results_path = 'workspace/output/llm_results_monitored.csv'
        product_specs_path = 'workspace/output/product_specs_monitored.csv'
        
        if not os.path.exists(llm_results_path):
            return jsonify({'error': f'LLM results file not found: {llm_results_path}'}), 404
        if not os.path.exists(product_specs_path):
            return jsonify({'error': f'Product specs file not found: {product_specs_path}'}), 404
        
        llm_results_df = pd.read_csv(llm_results_path)
        product_specs_df = pd.read_csv(product_specs_path)
        
        # Fill NaN values to avoid JSON serialization issues
        llm_results_df = llm_results_df.fillna('')
        product_specs_df = product_specs_df.fillna('')
        
        # Initialize validation state
        validation_state = {
            'failed_cells': {},
            'failed_rows': set(),
            'stats': {
                'total_rows': len(product_specs_df),
                'failed_rows': 0,
                'field_failures': {col: 0 for col in product_specs_df.columns if col != 'key'}
            }
        }
        
        return jsonify({
            'success': True,
            'total_products': len(product_specs_df),
            'columns': product_specs_df.columns.tolist(),
            'llm_columns': llm_results_df.columns.tolist()
        })
        
    except Exception as e:
        return jsonify({'error': f'Error loading data: {str(e)}'}), 500

@app.route('/view1')
def view1():
    """Row validation view"""
    return render_template('view1.html')

@app.route('/view2')
def view2():
    """Product inspection view"""
    return render_template('view2.html')

@app.route('/get_table_data')
def get_table_data():
    """Get product specs data for table display"""
    if product_specs_df is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    # Convert to records and add row indices
    data = []
    for idx, row in product_specs_df.iterrows():
        row_data = {
            'row_idx': idx,
            'data': row.to_dict()
        }
        data.append(row_data)
    
    return jsonify({
        'data': data,
        'columns': product_specs_df.columns.tolist(),
        'validation_state': {
            'failed_cells': validation_state['failed_cells'],
            'failed_rows': list(validation_state['failed_rows'])
        }
    })

@app.route('/get_product/<int:index>')
def get_product(index):
    """Return raw HTML, prompt, and LLM result for specific product"""
    if llm_results_df is None or product_specs_df is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    if index < 0 or index >= len(llm_results_df):
        return jsonify({'error': 'Invalid product index'}), 400
    
    try:
        llm_row = llm_results_df.iloc[index]
        spec_row = product_specs_df.iloc[index]
        
        # Convert pandas Series to dict and handle numpy types
        llm_dict = _convert_numpy_types(llm_row.to_dict())
        spec_dict = _convert_numpy_types(spec_row.to_dict())
        
        response_data = {
            'index': index,
            'total': len(product_specs_df),
            'raw_html': llm_dict.get('html_content', 'No HTML content available'),
            'prompt': llm_dict.get('prompt', 'No prompt available'),
            'llm_result': spec_dict,
            'url': llm_dict.get('product_url', 'No URL available'),
            'success': llm_dict.get('success', False),
            'llm_history': llm_results_history.get(index, [])
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({'error': f'Error retrieving product: {str(e)}'}), 500

@app.route('/get_models')
def get_models():
    """Return available OpenAI models from rate limiter"""
    if OpenAIRateLimiter is None:
        return jsonify({'error': 'LLM functionality not available'}), 503
    
    try:
        # Get available models from rate limiter
        available_models = list(OpenAIRateLimiter.RATE_LIMITS.keys())
        # Remove 'default' as it's not a real model
        available_models = [model for model in available_models if model != 'default']
        
        return jsonify({
            'success': True,
            'models': available_models,
            'llm_available': llm_invocator is not None
        })
    except Exception as e:
        return jsonify({'error': f'Error getting models: {str(e)}'}), 500

@app.route('/invoke_llm', methods=['POST'])
def invoke_llm():
    """Invoke LLM with selected model and prompt"""
    if llm_invocator is None:
        return jsonify({'error': 'LLM functionality not available'}), 503
    
    try:
        data = request.json
        model = data.get('model')
        prompt = data.get('prompt')
        product_index = data.get('product_index')
        
        if not model or not prompt:
            return jsonify({'error': 'Model and prompt are required'}), 400
        
        if product_index is None:
            return jsonify({'error': 'Product index is required'}), 400
        
        # Validate model
        available_models = list(OpenAIRateLimiter.RATE_LIMITS.keys())
        if model not in available_models:
            return jsonify({'error': f'Invalid model: {model}'}), 400
        
        # Invoke LLM
        response_text = llm_invocator.invoke_llm(
            model_provider="openai",
            llm_model_name=model,
            prompt=prompt,
            temperature=0.7,
            max_tokens=1000
        )
        
        # Parse JSON response
        try:
            result_data = json.loads(response_text)
        except json.JSONDecodeError:
            # If not valid JSON, treat as error
            result_data = None
            error_msg = "LLM response was not valid JSON"
        
        # Create result entry
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        result_entry = {
            'timestamp': timestamp,
            'model': model,
            'success': result_data is not None,
            'result': result_data,
            'raw_response': response_text,
            'error': error_msg if result_data is None else None
        }
        
        # Store in history
        if product_index not in llm_results_history:
            llm_results_history[product_index] = []
        
        # Insert at beginning (latest first)
        llm_results_history[product_index].insert(0, result_entry)
        
        return jsonify({
            'success': True,
            'result': result_entry,
            'history': llm_results_history[product_index]
        })
        
    except Exception as e:
        error_msg = f'LLM invocation failed: {str(e)}'
        print(f"LLM Error: {error_msg}")
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': error_msg}), 500

@app.route('/reject_cell', methods=['POST'])
def reject_cell():
    """Mark a specific cell as rejected"""
    data = request.json
    row_idx = data.get('row_idx')
    column = data.get('column')
    rejected = data.get('rejected', True)
    
    if row_idx is None or column is None:
        return jsonify({'error': 'Missing row_idx or column'}), 400
    
    # Update validation state
    if row_idx not in validation_state['failed_cells']:
        validation_state['failed_cells'][row_idx] = {}
    
    if rejected:
        # Only increment if cell wasn't already failed
        if column not in validation_state['failed_cells'][row_idx]:
            validation_state['failed_cells'][row_idx][column] = True
            validation_state['stats']['field_failures'][column] += 1
        else:
            validation_state['failed_cells'][row_idx][column] = True
    else:
        if column in validation_state['failed_cells'][row_idx]:
            del validation_state['failed_cells'][row_idx][column]
            validation_state['stats']['field_failures'][column] -= 1
        
        # Clean up empty row entries
        if not validation_state['failed_cells'][row_idx]:
            del validation_state['failed_cells'][row_idx]
    
    # Update stats
    _update_validation_stats()
    
    return jsonify({'success': True, 'stats': validation_state['stats']})

@app.route('/reject_row', methods=['POST'])
def reject_row():
    """Mark an entire row as rejected"""
    data = request.json
    row_idx = data.get('row_idx')
    rejected = data.get('rejected', True)
    
    if row_idx is None:
        return jsonify({'error': 'Missing row_idx'}), 400
    
    if rejected:
        validation_state['failed_rows'].add(row_idx)
    else:
        validation_state['failed_rows'].discard(row_idx)
    
    # Update stats
    _update_validation_stats()
    
    return jsonify({'success': True, 'stats': validation_state['stats']})

@app.route('/get_validation_stats')
def get_validation_stats():
    """Get current validation statistics"""
    return jsonify(validation_state['stats'])

@app.route('/export_validation')
def export_validation():
    """Export validation summary as CSV"""
    if product_specs_df is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    # Create validation summary
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Summary statistics
    summary_data = {
        'Validation Summary': [
            f'Total Products: {validation_state["stats"]["total_rows"]}',
            f'Failed Rows: {validation_state["stats"]["failed_rows"]}',
            f'Passed Rows: {validation_state["stats"]["total_rows"] - validation_state["stats"]["failed_rows"]}',
            f'Pass Rate: {((validation_state["stats"]["total_rows"] - validation_state["stats"]["failed_rows"]) / validation_state["stats"]["total_rows"] * 100):.1f}%',
            '',
            'Field Failure Counts:'
        ]
    }
    
    # Add field failures
    for field, count in validation_state['stats']['field_failures'].items():
        if count > 0:
            summary_data['Validation Summary'].append(f'{field}: {count} failures')
    
    # Create detailed report
    detailed_data = []
    for idx, row in product_specs_df.iterrows():
        row_failed = idx in validation_state['failed_rows']
        cell_failures = validation_state['failed_cells'].get(idx, {})
        
        detailed_row = {
            'row_index': idx,
            'product_url': llm_results_df.iloc[idx].get('product_url', '') if llm_results_df is not None else '',
            'row_status': 'FAILED' if row_failed else 'PASSED',
            'failed_cells': ', '.join(cell_failures.keys()) if cell_failures else '',
            'cell_failure_count': len(cell_failures)
        }
        
        # Add all product spec fields
        for col in product_specs_df.columns:
            detailed_row[f'spec_{col}'] = row[col]
            detailed_row[f'{col}_failed'] = col in cell_failures
        
        detailed_data.append(detailed_row)
    
    # Create CSV content
    output = StringIO()
    
    # Write summary section
    output.write("VALIDATION SUMMARY\n")
    for line in summary_data['Validation Summary']:
        output.write(f"{line}\n")
    
    output.write("\n\nDETAILED RESULTS\n")
    
    # Write detailed results
    if detailed_data:
        detailed_df = pd.DataFrame(detailed_data)
        detailed_df.to_csv(output, index=False)
    
    # Prepare file for download
    output.seek(0)
    filename = f'validation_results_{timestamp}.csv'
    
    # Create output directory if it doesn't exist
    output_dir = 'workspace/output'
    os.makedirs(output_dir, exist_ok=True)
    
    # Save to output directory
    file_path = os.path.join(output_dir, filename)
    with open(file_path, 'w') as f:
        f.write(output.getvalue())
    
    return send_file(file_path, as_attachment=True, download_name=filename, mimetype='text/csv')

def _convert_numpy_types(obj):
    """Convert numpy/pandas types to Python native types for JSON serialization"""
    if isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, (np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    elif isinstance(obj, (np.float64, np.float32, np.float16)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: _convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [_convert_numpy_types(item) for item in obj]
    elif pd.isna(obj):
        return None
    else:
        return obj

def _update_validation_stats():
    """Update validation statistics"""
    # Count rows that are either explicitly failed OR have any failed cells
    failed_row_indices = set(validation_state['failed_rows'])  # Explicitly failed rows
    failed_row_indices.update(validation_state['failed_cells'].keys())  # Rows with failed cells
    
    validation_state['stats']['failed_rows'] = len(failed_row_indices)

if __name__ == '__main__':
    app.run(debug=True, port=5002)