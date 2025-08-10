# 📦 Export Commands & File Structure

## 🎯 **Essential Files to Export**

### **📚 Core Library (lib/)**
```bash
lib/__init__.py
lib/core/__init__.py
lib/core/scraping.py
lib/core/html_processor.py
lib/core/llm.py
lib/core/evaluation.py
lib/core/models.py
lib/monitoring/__init__.py
lib/monitoring/pipeline_monitor.py
lib/monitoring/metrics_collector.py
lib/monitoring/error_analyzer.py
lib/monitoring/models.py
lib/benchmarking/__init__.py
lib/benchmarking/experiment_runner.py
lib/benchmarking/cache_manager.py
lib/benchmarking/report_generator.py
lib/benchmarking/models.py
lib/utils/__init__.py
lib/utils/openai_rate_limiter.py
```

### **📋 PRP Implementation**
```bash
prps/specifications/benchmarking-monitoring-system.md
prps/implementations/benchmarking_2025_07_07/README.md
prps/implementations/benchmarking_2025_07_07/scripts/run_benchmarks.py
prps/implementations/benchmarking_2025_07_07/scripts/specbook_monitored.py
prps/implementations/benchmarking_2025_07_07/tests/test_monitoring.py
prps/implementations/benchmarking_2025_07_07/tests/test_benchmarking.py
prps/implementations/benchmarking_2025_07_07/docs/implementation_plan.md
prps/implementations/benchmarking_2025_07_07/docs/usage_guide.md
```

### **🔄 Execution Results**
```bash
executions/2025-07-07_benchmarking/execution_metadata.json
executions/2025-07-07_benchmarking/results/benchmarks/
executions/2025-07-07_benchmarking/results/metrics/
executions/2025-07-07_benchmarking/results/logs/
```

### **🔗 Shared Resources**
```bash
shared/config/defaults.yaml
shared/models/__init__.py
shared/data/reference_data/llm_results.csv
shared/data/reference_data/product_specs.csv
shared/data/reference_data/specbook.csv
shared/cache/cache.db
shared/cache/*.html
```

### **🚧 Workspace**
```bash
workspace/input/specbook.csv
workspace/scripts/current_pipeline.py
workspace/notebooks/firecrawl.ipynb
workspace/notebooks/openapi.ipynb
workspace/notebooks/specbook.ipynb
```

### **🛠️ Tools & Management**
```bash
tools/workspace_manager.py
tools/docs/scraper_flow_diagram.svg
```

### **📖 Documentation**
```bash
README.md
SOURCE_OF_TRUTH.md
REFACTORING_COMPLETE.md
EXPORT_SUMMARY.md
CLAUDE.md
```

### **⚙️ Configuration**
```bash
requirements.txt
install_deps.sh
test_refactored_structure.py
```

### **🏛️ Applications**
```bash
verification_ui.py
agent/therma.py
agent/therma_pydantic.py
```

## 🚀 **Export Commands**

### **Option 1: Tar Archive (Recommended)**
```bash
# Create clean export excluding virtual environments and cache
tar -czf theranchmine-phase1-refactored.tar.gz \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='.git' \
  --exclude='*.pyc' \
  --exclude='.DS_Store' \
  --exclude='shared/cache/*.html' \
  .
```

### **Option 2: Zip Archive**
```bash
# Create zip archive
zip -r theranchmine-phase1-refactored.zip . \
  -x ".venv/*" "__pycache__/*" ".git/*" "*.pyc" ".DS_Store" "shared/cache/*.html"
```

### **Option 3: Git Clone (if using git)**
```bash
# If this is a git repository
git archive --format=tar.gz --output=theranchmine-phase1-refactored.tar.gz HEAD
```

### **Option 4: rsync Copy**
```bash
# Copy to new location with exclusions
rsync -av --exclude='.venv' --exclude='__pycache__' --exclude='.git' \
  --exclude='*.pyc' --exclude='.DS_Store' --exclude='shared/cache/*.html' \
  . /path/to/export/destination/
```

## 📊 **What Gets Exported**

### **✅ Essential Components:**
- Complete `lib/` reusable library
- Organized `prps/` PRP management system  
- Structured `executions/` tracking system
- Active `workspace/` development environment
- Shared `shared/` resources and configuration
- Professional documentation
- Management tools and utilities

### **📈 Size Estimates:**
- **With cache:** ~50-100MB (includes 60+ cached HTML files)
- **Without cache:** ~5-10MB (code and docs only)
- **Core library only:** ~2-3MB

### **🔍 Excluded (Optional):**
- `.venv/` - Virtual environment (recreate with `pip install -r requirements.txt`)
- `__pycache__/` - Python cache files (auto-generated)
- `.git/` - Git history (if present)
- Large cache files (optional, can be regenerated)

## 🎯 **After Export Instructions**

### **1. Setup on New System:**
```bash
# Extract
tar -xzf theranchmine-phase1-refactored.tar.gz
cd theranchmine-phase1-refactored/

# Install dependencies
pip install -r requirements.txt
# or
./install_deps.sh

# Verify structure
python test_refactored_structure.py
```

### **2. Quick Start:**
```bash
# Set up workspace
python tools/workspace_manager.py setup --prp benchmarking

# Run quick test
python prps/implementations/benchmarking_2025_07_07/scripts/run_benchmarks.py --quick-test
```

### **3. Environment Variables:**
```bash
export OPENAI_API_KEY="your-openai-api-key"
export FIRECRAWL_API_KEY="your-firecrawl-api-key"  # optional
```

## 📚 **Documentation Priority**

### **Read First:**
1. `README.md` - Project overview
2. `SOURCE_OF_TRUTH.md` - Complete structure reference
3. `EXPORT_SUMMARY.md` - Export details

### **For Development:**
1. `prps/implementations/benchmarking_2025_07_07/README.md` - PRP documentation  
2. `prps/implementations/benchmarking_2025_07_07/docs/usage_guide.md` - Usage instructions
3. `CLAUDE.md` - Development guidelines

**🚀 Your refactored, professional-grade PRP execution platform is ready for export!**