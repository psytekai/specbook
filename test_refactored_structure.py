#!/usr/bin/env python3
"""
Test script to validate the refactored project structure.
This verifies that all imports work correctly and the structure is functional.
"""
import sys
from pathlib import Path

# Add project root to path
sys.path.append(str(Path(__file__).parent))

def test_lib_imports():
    """Test that all lib components can be imported"""
    print("Testing lib imports...")
    
    try:
        # Test core imports
        from lib.core.scraping import StealthScraper
        from lib.core.html_processor import HTMLProcessor
        from lib.core.llm import LLMInvocator, PromptTemplator
        from lib.core.evaluation import ProductExtractionEvaluator
        from lib.core.models import ScrapeResult, ProcessedHTML
        print("  ✅ Core components imported successfully")
        
        # Test monitoring imports
        from lib.monitoring.pipeline_monitor import PipelineMonitor
        from lib.monitoring.metrics_collector import MetricsCollector
        from lib.monitoring.error_analyzer import ErrorAnalyzer
        from lib.monitoring.models import PipelineExecution, PipelineStage
        print("  ✅ Monitoring components imported successfully")
        
        # Test benchmarking imports
        from lib.benchmarking.experiment_runner import ExperimentRunner
        from lib.benchmarking.cache_manager import CacheManager
        from lib.benchmarking.report_generator import ReportGenerator
        from lib.benchmarking.models import ExperimentConfig
        print("  ✅ Benchmarking components imported successfully")
        
        # Test utils imports
        from lib.utils.openai_rate_limiter import OpenAIRateLimiter
        print("  ✅ Utils components imported successfully")
        
        # Test main lib import
        from lib import StealthScraper, PipelineMonitor, ExperimentRunner
        print("  ✅ Main lib API imported successfully")
        
        return True
        
    except ImportError as e:
        print(f"  ❌ Import error: {e}")
        return False

def test_structure_exists():
    """Test that all expected directories exist"""
    print("Testing directory structure...")
    
    expected_dirs = [
        "lib/core",
        "lib/monitoring", 
        "lib/benchmarking",
        "lib/utils",
        "prps/specifications",
        "prps/implementations/benchmarking_2025_07_07",
        "executions/2025-07-07_benchmarking",
        "workspace/input",
        "workspace/scripts",
        "shared/cache",
        "shared/config",
        "tools"
    ]
    
    missing_dirs = []
    for dir_path in expected_dirs:
        if not Path(dir_path).exists():
            missing_dirs.append(dir_path)
    
    if missing_dirs:
        print(f"  ❌ Missing directories: {', '.join(missing_dirs)}")
        return False
    else:
        print(f"  ✅ All {len(expected_dirs)} expected directories exist")
        return True

def test_prp_structure():
    """Test that PRP structure is correct"""
    print("Testing PRP structure...")
    
    prp_dir = Path("AISPECS/implementations/benchmarking_2025_07_07")
    expected_files = [
        "README.md",
        "scripts/run_benchmarks.py",
        "scripts/specbook_monitored.py", 
        "tests/test_monitoring.py",
        "tests/test_benchmarking.py",
        "docs/implementation_plan.md",
        "docs/usage_guide.md"
    ]
    
    missing_files = []
    for file_path in expected_files:
        if not (prp_dir / file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print(f"  ❌ Missing PRP files: {', '.join(missing_files)}")
        return False
    else:
        print(f"  ✅ All {len(expected_files)} expected PRP files exist")
        return True

def test_shared_resources():
    """Test that shared resources are set up correctly"""
    print("Testing shared resources...")
    
    expected_files = [
        "shared/config/defaults.yaml",
        "shared/models/__init__.py"
    ]
    
    missing_files = []
    for file_path in expected_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print(f"  ❌ Missing shared files: {', '.join(missing_files)}")
        return False
    else:
        print(f"  ✅ All {len(expected_files)} expected shared files exist")
        return True

def test_workspace_manager():
    """Test that workspace manager is functional"""
    print("Testing workspace manager...")
    
    try:
        from workspace.workspace_manager import WorkspaceManager
        manager = WorkspaceManager()
        print("  ✅ WorkspaceManager imported and instantiated successfully")
        return True
    except Exception as e:
        print(f"  ❌ WorkspaceManager error: {e}")
        return False

def main():
    """Run all structure validation tests"""
    print("🧪 Testing Refactored Structure")
    print("=" * 50)
    
    tests = [
        test_structure_exists,
        test_lib_imports,
        test_prp_structure,
        test_shared_resources,
        test_workspace_manager
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print(f"🎯 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ Refactored structure is valid and functional!")
        print("\n🚀 Ready to use the new scalable PRP platform!")
        return 0
    else:
        print("❌ Some issues found. Please fix before proceeding.")
        return 1

if __name__ == "__main__":
    exit(main())