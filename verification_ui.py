import csv
import json
import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd

app = Flask(__name__)

# Global variables to store data
data = []
current_index = 0
validation_results = []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    global data, current_index, validation_results
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Please upload a CSV file'}), 400
    
    # Read CSV file
    try:
        df = pd.read_csv(file)
        if 'url' not in df.columns or 'llm_message' not in df.columns:
            return jsonify({'error': 'CSV must contain "url" and "llm_message" columns'}), 400
        
        data = df.to_dict('records')
        current_index = 0
        validation_results = []
        
        return jsonify({
            'success': True,
            'total_records': len(data),
            'current_index': current_index
        })
    
    except Exception as e:
        return jsonify({'error': f'Error reading CSV: {str(e)}'}), 400

@app.route('/get_current_record')
def get_current_record():
    global data, current_index
    
    if not data or current_index >= len(data):
        return jsonify({'error': 'No data available'}), 400
    
    record = data[current_index]
    
    try:
        # Parse the JSON from llm_message
        llm_data = json.loads(record['llm_message'])
        return jsonify({
            'url': record['url'],
            'extracted_data': llm_data,
            'current_index': current_index,
            'total_records': len(data)
        })
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON in llm_message'}), 400

@app.route('/next')
def next_record():
    global current_index
    if current_index < len(data) - 1:
        current_index += 1
    return jsonify({'current_index': current_index})

@app.route('/previous')
def previous_record():
    global current_index
    if current_index > 0:
        current_index -= 1
    return jsonify({'current_index': current_index})

@app.route('/goto/<int:index>')
def goto_record(index):
    global current_index
    if 0 <= index < len(data):
        current_index = index
    return jsonify({'current_index': current_index})

@app.route('/validate', methods=['POST'])
def validate_record():
    global validation_results, data, current_index
    
    if current_index >= len(data):
        return jsonify({'error': 'No current record'}), 400
    
    validation_data = request.json
    validation_data['timestamp'] = datetime.now().isoformat()
    validation_data['record_index'] = current_index
    validation_data['url'] = data[current_index]['url']
    
    # Check if we already have a validation for this record
    existing_index = next((i for i, v in enumerate(validation_results) 
                          if v['record_index'] == current_index), None)
    
    if existing_index is not None:
        validation_results[existing_index] = validation_data
    else:
        validation_results.append(validation_data)
    
    return jsonify({'success': True})

@app.route('/summary')
def get_summary():
    global validation_results, data
    
    if not validation_results:
        return jsonify({'message': 'No validation results available'})
    
    total_validated = len(validation_results)
    total_records = len(data)
    
    valid_count = sum(1 for v in validation_results if v.get('is_valid') == 'valid')
    invalid_count = sum(1 for v in validation_results if v.get('is_valid') == 'invalid')
    
    summary = {
        'total_records': total_records,
        'total_validated': total_validated,
        'valid_count': valid_count,
        'invalid_count': invalid_count,
        'pending_count': total_records - total_validated,
        'validation_rate': (total_validated / total_records * 100) if total_records > 0 else 0,
        'accuracy_rate': (valid_count / total_validated * 100) if total_validated > 0 else 0
    }
    
    return jsonify(summary)

@app.route('/export', methods=['POST'])
def export_results():
    global validation_results, data
    
    if not validation_results:
        return jsonify({'error': 'No validation results to export'}), 400
    
    # Create a comprehensive export
    export_data = []
    
    for i, record in enumerate(data):
        validation = next((v for v in validation_results if v['record_index'] == i), None)
        
        export_row = {
            'record_index': i,
            'url': record['url'],
            'llm_message': record['llm_message'],
            'is_valid': validation.get('is_valid') if validation else 'not_validated',
            'notes': validation.get('notes') if validation else '',
            'timestamp': validation.get('timestamp') if validation else ''
        }
        
        export_data.append(export_row)
    
    # Save to CSV
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'validation_results_{timestamp}.csv'
    
    df = pd.DataFrame(export_data)
    df.to_csv(filename, index=False)
    
    return jsonify({
        'success': True,
        'filename': filename,
        'message': f'Results exported to {filename}'
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001) 