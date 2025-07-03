# Product Data Verification Tool

A web-based tool for manually verifying product data extracted from web scraping. This tool provides a side-by-side interface to compare the original product website with the extracted data, allowing you to validate the accuracy of your scraping pipeline.

## Features

- **Side-by-side comparison**: View the original product website alongside extracted data
- **Image validation**: Compare the extracted product image with the actual website
- **Navigation controls**: Easy navigation between records with keyboard shortcuts
- **Validation tracking**: Mark records as valid/invalid with notes
- **Summary dashboard**: View validation statistics and progress
- **Export functionality**: Save validation results to CSV
- **Responsive design**: Works on desktop and mobile devices

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python verification_ui.py
```

3. Open your browser and navigate to `http://localhost:5001`

## Usage

### 1. Upload CSV File
- The CSV file should contain two columns: `url` and `llm_message`
- `url`: The product website URL
- `llm_message`: JSON string containing extracted product data

Example CSV format:
```csv
url,llm_message
https://example.com/product1,"{""image_url"": ""https://example.com/image1.jpg"", ""type"": ""paint color"", ""description"": ""Product description"", ""model_no"": ""ABC123"", ""product_link"": ""https://example.com/product1"", ""qty"": ""1"", ""key"": ""PROD1""}"
```

### 2. Verify Data
- **Left panel**: Shows the original product website in an iframe
- **Right panel**: Displays the extracted data including:
  - Extracted product image
  - Product type, description, model number, etc.
- **Validation controls**: Mark as Valid/Invalid and add notes

### 3. Navigation
- Use Previous/Next buttons or arrow keys
- Keyboard shortcuts:
  - `←` / `→`: Navigate between records
  - `V`: Mark as Valid
  - `I`: Mark as Invalid
  - `Ctrl+S` / `Cmd+S`: Save validation

### 4. Summary and Export
- Click "Summary" to view validation statistics
- Click "Export Results" to save validation data to CSV

## Output

The exported CSV will contain:
- `record_index`: Position in the original dataset
- `url`: Original product URL
- `llm_message`: Original extracted data
- `is_valid`: Validation result (valid/invalid/not_validated)
- `notes`: Any notes added during validation
- `timestamp`: When the validation was performed

## Example Data

The tool works with your existing CSV file format. For example, using the provided `4-llm-1751516005.csv`:

```csv
url,llm_message
https://www.dunnedwards.com/colors/browser/dew340,"{""image_url"": ""https://h6a8m2f3.delivery.rocketcdn.me/wp-content/uploads/2023/06/DEW340.jpg"", ""type"": ""paint color"", ""description"": ""Whisper DEW340 is a bright, warm white paint color..."", ""model_no"": ""DEW340 RL#003"", ""product_link"": ""https://www.dunnedwards.com/colors/browser/dew340"", ""qty"": ""unspecified"", ""key"": ""DEW340""}"
```

## Technical Details

- **Backend**: Flask web server
- **Frontend**: HTML/CSS/JavaScript with responsive design
- **Data storage**: In-memory storage during session
- **File handling**: CSV upload and export
- **Cross-origin**: Handles iframe loading of external websites

## Troubleshooting

1. **Iframe loading issues**: Some websites block iframe embedding. The tool will still work for data validation.

2. **Image loading errors**: If extracted images fail to load, they will be hidden automatically.

3. **Large CSV files**: The tool loads the entire CSV into memory. For very large files, consider processing in batches.

4. **Browser compatibility**: Works best in modern browsers (Chrome, Firefox, Safari, Edge).

## Customization

You can modify the tool by:
- Adjusting the CSS styles in `templates/index.html`
- Adding new validation fields in the Flask backend
- Customizing the export format
- Adding additional keyboard shortcuts

## License

This tool is provided as-is for data validation purposes. 