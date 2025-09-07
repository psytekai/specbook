# 🏗️ Project Structure Refactoring Plan

## 🎯 **Current Issues & Challenges**

### **Problems with Current Structure:**
1. **Mixed Concerns**: Demo files, cache analysis, and docs scattered at root level
2. **No PRP Execution Tracking**: Results from different PRPs mixed together  
3. **Scalability Issues**: Structure will become messy with multiple PRPs
4. **No Clear Separation**: Core library vs PRP-specific implementations
5. **Data Chaos**: All data mixed in `data/` without clear organization
6. **No Versioning**: Can't track which PRP generated which code/results
7. **Tool Pollution**: `tools/` mixing core infrastructure with PRP-specific code

### **Current Structure Problems:**
```
phase1-specbook/
├── 01_llmpipeline/              # ❌ Confusing name, mixed with new data
├── tools/                       # ❌ Core + PRP-specific mixed together
│   ├── monitoring/              # ✅ Good organization within
│   ├── benchmarking/            # ✅ Good organization within  
│   └── [original tools mixed]   # ❌ No clear separation
├── data/                        # ❌ All PRPs will dump here
├── scripts/                     # ❌ Original + new scripts mixed
├── context/                     # ❌ Planning mixed with implementation
├── [demo files at root]         # ❌ Clutter
└── [analysis files at root]     # ❌ No organization
```

---

## 🏛️ **Proposed Refactored Structure**

### **🎯 Design Principles:**
1. **Separation of Concerns**: Core library vs PRP implementations vs executions
2. **Scalability**: Easy to add new PRPs without conflicts
3. **Traceability**: Clear tracking from PRP → Implementation → Results
4. **Reusability**: Core components shared across PRPs
5. **Maintainability**: Logical organization for long-term development

### **📁 New Project Structure:**

```
theranchmine-phase1/
├── 📚 lib/                      # Core reusable library
│   ├── core/                    # Fundamental components
│   │   ├── __init__.py
│   │   ├── scraping.py          # stealth_scraper, html_processor
│   │   ├── llm.py               # llm_invocator, prompt_templator  
│   │   ├── evaluation.py        # eval_product_extraction
│   │   └── models.py            # Core data models
│   ├── monitoring/              # Monitoring infrastructure
│   │   ├── __init__.py
│   │   ├── pipeline_monitor.py
│   │   ├── metrics_collector.py
│   │   ├── error_analyzer.py
│   │   └── models.py
│   ├── benchmarking/            # Benchmarking infrastructure  
│   │   ├── __init__.py
│   │   ├── experiment_runner.py
│   │   ├── cache_manager.py
│   │   ├── report_generator.py
│   │   └── models.py
│   └── utils/                   # Shared utilities
│       ├── __init__.py
│       ├── file_utils.py
│       ├── logging_utils.py
│       └── config_utils.py
├── 📋 prps/                     # PRP Management
│   ├── specifications/          # PRP definitions
│   │   ├── benchmarking-monitoring-system.md
│   │   ├── feature-x-system.md
│   │   └── README.md
│   ├── implementations/         # PRP-specific code
│   │   ├── benchmarking_2025_07_07/
│   │   │   ├── README.md        # Implementation summary
│   │   │   ├── scripts/         # PRP-specific scripts
│   │   │   │   ├── specbook_monitored.py
│   │   │   │   └── run_benchmarks.py
│   │   │   ├── tests/           # PRP-specific tests
│   │   │   │   ├── test_monitoring.py
│   │   │   │   └── test_benchmarking.py
│   │   │   ├── configs/         # PRP configurations
│   │   │   │   └── benchmarking.yaml
│   │   │   └── docs/            # PRP documentation
│   │   │       ├── implementation_plan.md
│   │   │       ├── usage_guide.md
│   │   │       └── architecture.md
│   │   └── feature_x_2025_07_10/
│   │       └── [similar structure]
│   └── archive/                 # Completed/deprecated PRPs
│       └── legacy_prp_v1/
├── 🔄 executions/               # Execution results & tracking
│   ├── 2025-07-07_benchmarking/
│   │   ├── execution_metadata.json     # Execution details
│   │   ├── results/
│   │   │   ├── reports/                # Generated reports
│   │   │   ├── metrics/                # Monitoring data
│   │   │   ├── benchmarks/             # Benchmark results
│   │   │   └── logs/                   # Execution logs
│   │   ├── configs/                    # Configs used
│   │   └── artifacts/                  # Generated artifacts
│   ├── 2025-07-08_production_run/
│   └── 2025-07-10_feature_x_test/
├── 🚧 workspace/                # Current working directory  
│   ├── input/                   # Input data
│   │   ├── specbook.csv         # Current input data
│   │   └── test_urls.csv        # Test data
│   ├── scripts/                 # Active working scripts
│   │   ├── current_pipeline.py  # Main pipeline
│   │   └── quick_test.py        # Quick testing
│   ├── notebooks/               # Analysis notebooks
│   │   ├── data_exploration.ipynb
│   │   └── results_analysis.ipynb
│   ├── temp/                    # Temporary files
│   └── output/                  # Current outputs
├── 🔗 shared/                   # Shared resources
│   ├── cache/                   # Persistent cache across PRPs
│   │   ├── html_cache.db
│   │   └── cached_content/
│   ├── models/                  # Shared data models
│   │   ├── __init__.py
│   │   └── common_models.py
│   ├── config/                  # Global configuration
│   │   ├── defaults.yaml
│   │   ├── models.yaml
│   │   └── environments/
│   └── data/                    # Persistent shared data
│       ├── reference_data/
│       └── lookup_tables/
├── 📖 docs/                     # Documentation
│   ├── architecture/            # System architecture
│   │   ├── overview.md
│   │   ├── data_flow.md
│   │   └── component_design.md
│   ├── guides/                  # User guides
│   │   ├── getting_started.md
│   │   ├── prp_development.md
│   │   ├── execution_guide.md
│   │   └── troubleshooting.md
│   ├── api/                     # API documentation
│   │   ├── lib_reference.md
│   │   └── examples/
│   └── decisions/               # Architecture decisions
│       ├── ADR-001-structure.md
│       └── ADR-002-caching.md
├── 🧪 tests/                    # Comprehensive test suite
│   ├── unit/                    # Unit tests for lib/
│   │   ├── test_core/
│   │   ├── test_monitoring/
│   │   └── test_benchmarking/
│   ├── integration/             # Integration tests
│   │   ├── test_pipeline_integration.py
│   │   └── test_prp_workflows.py
│   ├── fixtures/                # Test data and fixtures
│   │   ├── sample_data/
│   │   └── mock_responses/
│   └── e2e/                     # End-to-end tests
│       └── test_full_pipeline.py
├── 🛠️ tools/                    # Development & management tools
│   ├── prp_manager.py           # PRP lifecycle management
│   ├── execution_tracker.py     # Track and analyze executions
│   ├── workspace_manager.py     # Manage workspace state  
│   ├── cache_manager.py         # Cache management utilities
│   ├── report_generator.py      # Cross-PRP reporting
│   └── cleanup.py               # Cleanup and maintenance
├── 📦 requirements/             # Dependencies
│   ├── base.txt                 # Core requirements
│   ├── dev.txt                  # Development requirements
│   └── optional.txt             # Optional features
├── 🔧 config/                   # Project configuration
│   ├── settings.py              # Global settings
│   ├── logging.yaml             # Logging configuration
│   └── environments/            # Environment-specific configs
│       ├── development.yaml
│       ├── testing.yaml
│       └── production.yaml
├── README.md                    # Project overview
├── CONTRIBUTING.md              # Development guidelines
├── CHANGELOG.md                 # Change tracking
└── pyproject.toml               # Python project configuration
```

---

## 🔄 **Migration Strategy**

### **Phase 1: Core Library Extraction** (Week 1)
```bash
# 1. Create new lib/ structure
mkdir -p lib/{core,monitoring,benchmarking,utils}

# 2. Move and refactor core components
mv tools/stealth_scraper.py lib/core/scraping.py
mv tools/llm_invocator.py tools/prompt_templator.py lib/core/llm.py
mv tools/eval_product_extraction.py lib/core/evaluation.py

# 3. Move infrastructure components  
mv tools/monitoring/ lib/monitoring/
mv tools/benchmarking/ lib/benchmarking/

# 4. Update all imports throughout codebase
# 5. Create lib/__init__.py with clean API
```

### **Phase 2: PRP Organization** (Week 1)
```bash
# 1. Create PRP structure
mkdir -p prps/{specifications,implementations,archive}

# 2. Move current PRP
mkdir prps/implementations/benchmarking_2025_07_07/
mv scripts/specbook_monitored.py scripts/run_benchmarks.py prps/implementations/benchmarking_2025_07_07/scripts/
mv tests/test_monitoring.py tests/test_benchmarking.py prps/implementations/benchmarking_2025_07_07/tests/

# 3. Move PRP documentation
mv context/prps/benchmarking-monitoring-system.md prps/specifications/
mv context/plans/task_25_07_07_benchmarking.md prps/implementations/benchmarking_2025_07_07/docs/
```

### **Phase 3: Execution Tracking** (Week 2)
```bash
# 1. Create execution structure
mkdir -p executions/2025-07-07_benchmarking/{results,configs,artifacts}

# 2. Move execution data
mv data/ executions/2025-07-07_benchmarking/results/

# 3. Create execution metadata
# 4. Implement execution tracker tool
```

### **Phase 4: Workspace Setup** (Week 2)
```bash
# 1. Create workspace
mkdir -p workspace/{input,scripts,notebooks,temp,output}

# 2. Move current working files
mv 01_llmpipeline/specbook.csv workspace/input/
mv notebooks/ workspace/notebooks/

# 3. Create workspace manager tool
# 4. Set up shared resources
```

---

## 🎯 **Benefits of New Structure**

### **1. 🏗️ Scalability**
- **Multiple PRPs**: Each PRP gets isolated implementation space
- **Execution Tracking**: Every run tracked with full context
- **Growth Management**: Structure scales linearly with PRPs

### **2. 🧩 Maintainability**  
- **Clear Separation**: Core library vs implementations vs results
- **Single Responsibility**: Each directory has one clear purpose
- **Easy Navigation**: Intuitive structure for developers

### **3. 🔍 Traceability**
- **PRP → Implementation**: Clear path from specification to code
- **Implementation → Results**: Direct linking of executions
- **Historical Tracking**: Full audit trail of all changes

### **4. 🔄 Reusability**
- **Core Library**: Shared components across all PRPs
- **Pattern Reuse**: Implementation patterns can be templated
- **Configuration Management**: Reusable config patterns

### **5. 🚀 Developer Experience**
- **Clean API**: `from lib.monitoring import PipelineMonitor`
- **Easy Testing**: Isolated test suites per component
- **Clear Documentation**: Organized by audience and purpose

---

## 🛠️ **New Development Workflow**

### **Creating a New PRP:**
```bash
# 1. Create PRP specification
tools/prp_manager.py create --name "feature-x" --template "standard"

# 2. Develop in isolated space
cd prps/implementations/feature_x_2025_07_10/
# Edit scripts/, tests/, configs/

# 3. Execute and track
tools/execution_tracker.py run --prp "feature-x" --config "development"

# 4. Results automatically organized
# executions/2025-07-10_feature_x_dev/
```

### **Running Existing PRP:**
```bash
# 1. Set up workspace
tools/workspace_manager.py setup --prp "benchmarking"

# 2. Run from workspace  
cd workspace/
python ../prps/implementations/benchmarking_2025_07_07/scripts/run_benchmarks.py

# 3. Results tracked automatically
```

### **Cross-PRP Analysis:**
```bash
# Compare results across PRPs
tools/report_generator.py compare \
  --execution1 "2025-07-07_benchmarking" \
  --execution2 "2025-07-10_feature_x" \
  --output "docs/analysis/cross_prp_comparison.md"
```

---

## 📊 **Migration Effort Estimation**

### **Effort Breakdown:**
- **Phase 1** (Core Library): ~3 days
  - Extract and refactor core components
  - Update imports throughout codebase
  - Create clean API interfaces

- **Phase 2** (PRP Organization): ~2 days  
  - Reorganize PRP-specific code
  - Move documentation and tests
  - Create PRP templates

- **Phase 3** (Execution Tracking): ~2 days
  - Implement execution tracker
  - Move and organize historical data
  - Create metadata structures

- **Phase 4** (Workspace Setup): ~1 day
  - Set up workspace structure
  - Create management tools
  - Document new workflows

**Total Effort**: ~8 days for complete refactoring

### **Risk Mitigation:**
- **Incremental Migration**: Each phase can be done independently
- **Backward Compatibility**: Keep old structure until migration complete
- **Testing**: Comprehensive tests ensure nothing breaks
- **Documentation**: Clear migration guide for team

---

## 🎯 **Implementation Priority**

### **High Priority** (Do First):
1. ✅ **Core Library Extraction** - Enables reuse
2. ✅ **PRP Organization** - Prevents future conflicts  
3. ✅ **Execution Tracking** - Critical for accountability

### **Medium Priority** (Do Second):
4. 🔄 **Workspace Setup** - Improves developer experience
5. 🔄 **Documentation Organization** - Long-term maintainability  

### **Low Priority** (Do Later):
6. 📈 **Cross-PRP Analytics** - Nice to have
7. 🧹 **Legacy Cleanup** - Can be done incrementally

This refactoring will transform the project from a single-PRP implementation into a **scalable PRP execution platform** that can handle dozens of PRPs without organizational chaos! 🚀