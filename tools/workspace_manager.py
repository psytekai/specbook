#!/usr/bin/env python3
"""
Workspace Manager - Manage the active workspace for development and testing

This tool helps set up and manage the workspace/ directory for active development.
"""
import argparse
import shutil
import yaml
from pathlib import Path
from typing import Dict, Any, Optional


class WorkspaceManager:
    """Manages workspace setup and configuration"""
    
    def __init__(self, workspace_dir: str = "workspace"):
        self.workspace_dir = Path(workspace_dir)
        self.config_dir = Path("shared/config")
        
    def setup_workspace(self, prp_name: Optional[str] = None) -> None:
        """Set up workspace for development"""
        print(f"Setting up workspace in {self.workspace_dir}")
        
        # Ensure workspace directories exist
        for subdir in ["input", "scripts", "notebooks", "temp", "output"]:
            (self.workspace_dir / subdir).mkdir(exist_ok=True, parents=True)
            
        # Copy default configuration
        if self.config_dir.exists():
            shutil.copy2(
                self.config_dir / "defaults.yaml",
                self.workspace_dir / "config.yaml"
            )
            
        # If PRP specified, copy relevant files
        if prp_name:
            self._setup_prp_workspace(prp_name)
            
        print("✅ Workspace setup complete")
        
    def _setup_prp_workspace(self, prp_name: str) -> None:
        """Set up workspace for specific PRP"""
        prp_implementations = Path("prps/implementations")
        
        # Find matching PRP implementation
        matching_prp = None
        for prp_dir in prp_implementations.iterdir():
            if prp_name.lower() in prp_dir.name.lower():
                matching_prp = prp_dir
                break
                
        if not matching_prp:
            print(f"❌ No PRP implementation found for '{prp_name}'")
            return
            
        print(f"📋 Setting up workspace for PRP: {matching_prp.name}")
        
        # Copy scripts to workspace
        scripts_dir = matching_prp / "scripts"
        if scripts_dir.exists():
            for script in scripts_dir.glob("*.py"):
                target = self.workspace_dir / "scripts" / script.name
                shutil.copy2(script, target)
                print(f"  Copied {script.name} to workspace/scripts/")
                
        # Copy notebooks if they exist
        notebooks_dir = matching_prp / "notebooks"
        if notebooks_dir.exists():
            for notebook in notebooks_dir.glob("*.ipynb"):
                target = self.workspace_dir / "notebooks" / notebook.name
                shutil.copy2(notebook, target)
                print(f"  Copied {notebook.name} to workspace/notebooks/")
    
    def clean_workspace(self) -> None:
        """Clean temporary files from workspace"""
        temp_dir = self.workspace_dir / "temp"
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
            temp_dir.mkdir()
            print("🧹 Cleaned workspace/temp/")
            
        # Clean output files older than 7 days
        output_dir = self.workspace_dir / "output"
        if output_dir.exists():
            import time
            week_ago = time.time() - (7 * 24 * 60 * 60)
            
            for file_path in output_dir.rglob("*"):
                if file_path.is_file() and file_path.stat().st_mtime < week_ago:
                    file_path.unlink()
                    print(f"  Removed old file: {file_path.name}")
    
    def status(self) -> None:
        """Show workspace status"""
        print(f"📊 Workspace Status: {self.workspace_dir}")
        print("=" * 50)
        
        if not self.workspace_dir.exists():
            print("❌ Workspace not initialized")
            return
            
        # Check each subdirectory
        for subdir in ["input", "scripts", "notebooks", "temp", "output"]:
            dir_path = self.workspace_dir / subdir
            if dir_path.exists():
                file_count = len(list(dir_path.rglob("*")))
                print(f"  {subdir:10} {file_count:3d} files")
            else:
                print(f"  {subdir:10} ❌ missing")
                
        # Check configuration
        config_file = self.workspace_dir / "config.yaml"
        if config_file.exists():
            print(f"  config     ✅ present")
        else:
            print(f"  config     ❌ missing")


def main():
    parser = argparse.ArgumentParser(
        description="Manage workspace for development and testing"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Setup command
    setup_parser = subparsers.add_parser("setup", help="Set up workspace")
    setup_parser.add_argument("--prp", help="PRP name to set up workspace for")
    
    # Clean command
    subparsers.add_parser("clean", help="Clean workspace temporary files")
    
    # Status command  
    subparsers.add_parser("status", help="Show workspace status")
    
    args = parser.parse_args()
    
    manager = WorkspaceManager()
    
    if args.command == "setup":
        manager.setup_workspace(args.prp)
    elif args.command == "clean":
        manager.clean_workspace()
    elif args.command == "status":
        manager.status()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()