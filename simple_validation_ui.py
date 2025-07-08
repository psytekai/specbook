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
        
        # Parse LLM response if it's JSON string
        llm_result = spec_row.to_dict()
        
        return jsonify({
            'index': index,
            'total': len(product_specs_df),
            'raw_html': llm_row.get('html_content', 'No HTML content available'),
            'prompt': llm_row.get('prompt', 'No prompt available'),
            'llm_result': llm_result,
            'url': llm_row.get('product_url', 'No URL available'),
            'success': llm_row.get('success', False)
        })
        
    except Exception as e:
        return jsonify({'error': f'Error retrieving product: {str(e)}'}), 500

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
        validation_state['failed_cells'][row_idx][column] = True
        validation_state['stats']['field_failures'][column] += 1
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

def _update_validation_stats():
    """Update validation statistics"""
    validation_state['stats']['failed_rows'] = len(validation_state['failed_rows'])

if __name__ == '__main__':
    app.run(debug=True, port=5002)