# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-09-27

[Category & Location CRUD Operates]
### Added
- Full CRUD operations for categories and locations
  - Create, update, and delete categories with automatic product reference cleanup
  - Create, update, and delete locations with automatic product reference cleanup
  - Inline editing UI for renaming categories and locations
  - Confirmation dialogs for safe deletion
- Database migration 2 with comprehensive schema improvements
  - Automatic conversion of name-based references to ID-based references
  - Safe data migration preserving all existing information

### Changed
- **BREAKING**: Categories and locations now use IDs instead of names
  - Database stores category/location IDs in products table
  - Frontend components updated to work with ID references
  - API endpoints now expect and return IDs
- Made categories and locations optional fields for products
  - Removed NOT NULL constraints from database schema
  - Products can now be created without categories or locations
- Improved data integrity with proper foreign key-like relationships
- Enhanced UI for managing categories and locations
  - Edit icons for inline renaming
  - Delete icons with confirmation dialogs
  - Better visual organization in product forms

### Fixed
- Category and location persistence issues
- NOT NULL constraint violations when creating products
- Duplicate name handling with proper error messages
- Reference cleanup when deleting categories/locations

### Technical Improvements
- Proper ID-based referential integrity
- Automatic cleanup of orphaned references
- Better error handling for CRUD operations
- Improved migration safety with edge case handling

[Enhancements]
### Added
- Bulk delete functionality for products with checkbox selection system
- "Select All" capability for bulk operations
- Confirmation dialog for bulk delete operations to prevent accidental data loss
- Database migration system for schema changes
- Product name as a required field for data integrity

### Changed
- **BREAKING**: Renamed product field from `description` to `name` for better semantic clarity
- Consolidated type definitions to shared module (`src/shared/types.ts`)
- Rearranged table columns for improved workflow and readability
- Enhanced scraper data extraction for better handling of product names vs descriptions
- Simplified Python bridge initialization process
- Improved product page styling with better spacing and visual organization
- Enhanced project page CSS for cleaner layout

### Fixed
- Python bridge error handling now properly surfaces errors to UI
- Table settings modal styling issues
- Type inconsistencies between frontend and backend
- Redundant re-renders in table components

### Removed
- Duplicate type definitions across renderer and main process
- Redundant Python bridge initialization code
- Significant amount of dead code (~488 deletions)

### Technical Improvements
- Better TypeScript inference throughout the codebase
- Streamlined communication between Electron and Python processes
- Optimized bulk delete operations for large selections
- Improved error recovery mechanisms
- Enhanced user feedback when operations fail

### Migration Notes
- Existing projects will automatically migrate the `description` field to `name`
- No data loss during migration
- Projects created before this change will continue to work seamlessly

## [0.2.0]

### Added

sData Architecture Simplification and Bug Fixes
- Simplified data architecture by removing API-to-internal field mapping layer
  - Eliminated unnecessary `apiFieldMappings.ts` transformation system
  - Components now work directly with internal domain model field names
  - Streamlined data flow: Database ↔ Internal Schema ↔ UI
- Enhanced debugging and logging capabilities
  - Added structured logging throughout API handlers using centralized Logger
  - Improved error tracking and context in product CRUD operations
  - Better validation error messages for user feedback
- Centralized type system improvements
  - Moved `Product` interface to `shared/types.ts` for consistency
  - Enhanced type safety across main and renderer processes
  - Aligned TypeScript interfaces with database schema

### Fixed
- **Critical System Bugs**
  - Fixed recent projects menu synchronization race condition across windows
  - Implemented centralized `updateRecentProjectsAndBroadcast()` method in ApplicationMenu
  - Added IPC event broadcasting to keep all renderer processes synchronized
  - Enhanced preload script with `onRecentProjectsChanged` listener
- **UI/UX Improvements**
  - Fixed React key collision issues in toast system when multiple toasts added quickly
  - Implemented robust UUID generation for toast IDs using `crypto.randomUUID()`
  - Enhanced product image display logic (prioritize primary image over thumbnail)
  - Improved manual details toggle in product creation form
- **Database and Validation**
  - Added comprehensive field validation in ProjectFileManager
  - Required field validation for `url`, `tagId`, `productName`, `location`, and `category`
  - Updated database constraints to match required field validations
  - Made `tag_id`, `location`, `category`, and `product_name` NOT NULL in database schema

### Changed
- Updated form components to use internal field names
  - `ProductNew.tsx`: Changed from API-style names (`productUrl`) to internal (`url`)
  - `ProductPage.tsx`: Enhanced product display with tag ID in header
  - Consistent field naming across all product CRUD operations
- Cleaned up development and debugging tools
  - Removed Python diagnostics functionality that was no longer needed
  - Streamlined Python bridge interface by removing `pythonRunDiagnostics`
  - Removed deprecated diagnostic UI components

### Removed
- API field mapping system (`apiFieldMappings.ts`)
- Python diagnostics IPC handlers and UI components
- Redundant field transformation logic in API handlers

[Phase 5.1] Windows Python Bridge and API Key Management
- Fixed critical Python bridge communication issues on Windows platform
  - Implemented line-based JSON protocol with proper newline handling
  - Updated stdin/stdout communication for cross-platform compatibility
  - Added environment variable passing for configuration options
  - Enhanced error handling and process termination logic
- Created secure API key management system
  - New dedicated API Keys page in React application
  - Non-blocking UI implementation preventing main process hangs
  - Persistent storage using Electron store
  - Secure IPC communication for key retrieval
- Enhanced Windows build infrastructure
  - Added pre-built native modules for better-sqlite3 and sharp
  - Included PyInstaller Windows x64 executable bundle
  - Updated electron-builder configuration for Windows packaging
  - Added resource extraction and management scripts
- Improved developer experience
  - Added comprehensive logging infrastructure (Logger.ts)
  - Created Windows-specific build and test scripts
  - Enhanced debugging capabilities for Python bridge
  - Streamlined CI/CD workflow for Windows builds

### Fixed
- **Windows Platform Issues**
  - Resolved Python bridge stdin/stdout communication failures on Windows
  - Fixed API key dialog blocking main process execution
  - Corrected native module compilation issues in CI/CD pipeline
  - Fixed electron-builder resource packaging for Windows distribution
- **Cross-platform Compatibility**
  - Standardized line-ending handling between platforms
  - Fixed JSON parsing issues in Python bridge communication
  - Resolved path separator issues in Windows builds
  - Corrected environment variable handling across platforms

### Changed
- Updated CI/CD workflow to remove pull request triggers
- Modified Python bridge to use environment variables for options
- Enhanced electron-builder configuration with Windows-specific settings
- Improved IPC handlers for better error handling and logging

[Phase 5.0] Python Integration & File System Architecture
- Implemented complete Python scraping integration for desktop application
  - PyInstaller bundle strategy with standalone executables (~40-60MB)
  - Cross-platform CI/CD pipeline for Windows and macOS package generation
  - Electron Bridge V2 with structured JSON communication via stdin/stdout
  - Real-time progress tracking and robust error handling
  - Product scraping with automatic image download and asset management
- Created comprehensive Python bridge architecture
  - `usePythonScraper` React hook for bridge integration with availability checking
  - `electron_bridge.py` CLI interface for product scraping operations
  - Bundle automation scripts with PyInstaller integration
  - Multi-platform build automation via GitHub Actions
- Enhanced file system resource management
  - Proper bundling of Python executables in `resources/python/electron_bridge/`
  - Cross-platform executable naming conventions
  - Automated dependency packaging and optimization
- Added systems architecture review capabilities
  - Systems architect reviewer agent for code quality oversight
  - Comprehensive architectural analysis and integration planning
  - Best practices enforcement and technical guidance

### Fixed
- **Critical Bug Fixes**
  - Fixed Cmd+Q infinite loop issue on macOS application quit handling
  - Resolved Python bridge status display showing errors during legitimate checking
  - Removed problematic automatic category assignment from scraped data
  - Fixed progress tracking and timeout handling in scraping operations
- **UI/UX Improvements**
  - Enhanced Python bridge availability status messages with loading states
  - Improved form field mapping from scraper results to UI components
  - Better error handling and user feedback during scraping operations
  - Fixed load percentage calculations and progress indicators

### Changed
- Updated CI/CD pipeline architecture
  - Multi-stage build process: Python bundles → Electron apps
  - Parallel Windows and macOS build execution
  - Automated artifact management and distribution
  - Build triggers for Python backend and Electron app changes
- Enhanced development workflow
  - Updated bundle generation commands for local development
  - Cross-platform compatibility testing via CI/CD
  - Improved resource path handling for production packaging
- Refined Python integration approach
  - Migrated from development-time Python execution to bundled executables
  - Maintained backward compatibility while enabling production deployment
  - Streamlined dependency management and distribution

[Phase 4.9] Asset Utility Functions Integration (Final)
- Implemented comprehensive asset utility functions across the application
  - Created `useAsset` hook for centralized asset management in React components
  - Integrated asset utilities with existing product management workflows
  - Added consistent asset handling patterns throughout the UI
  - Enhanced error handling for asset-related operations
- Updated product creation and editing forms to use new asset system
  - Removed redundant image upload components
  - Unified asset handling through AssetManager service
  - Improved user experience with consistent asset management patterns

[Phase 4.8] React Form Components Cleanup
- Cleaned up and standardized React form components
  - Removed duplicate or inconsistent form patterns
  - Established consistent form component architecture
  - Improved type safety across form components
  - Enhanced form validation and error handling

[Phase 4.7] Product CRUD Asset Integration
- Updated all product CRUD operations to work with asset management system
  - Modified `createProduct` to handle asset hashes instead of URLs
  - Enhanced `updateProduct` to manage asset references properly
  - Added automatic asset cleanup when products are deleted
  - Integrated asset reference counting with product lifecycle
- Implemented asset protocol for secure asset serving
  - Added `asset://` protocol handler for serving stored assets
  - Enhanced security for asset access from renderer process
  - Implemented proper asset URL generation and validation

[Phase 4.6] Asset Manager React Integration
- Integrated AssetManager with React components
  - Updated ProductNew component to use AssetManager
  - Removed legacy image upload patterns
  - Added proper asset handling in product forms
  - Integrated thumbnail display with asset protocol

[Phase 4.5] Asset IPC Integration
- Implemented comprehensive IPC bridge for AssetManager functionality (`assetHandlers.ts`)
  - `asset:upload` - Upload and store assets with automatic thumbnail generation
  - `asset:get-path` - Retrieve asset file paths for serving to renderer process
  - `asset:delete` - Safe asset deletion with reference counting
  - `asset:cleanup` - Orphaned asset cleanup with dry-run option
  - `asset:import-batch` - Batch import multiple assets with progress tracking
  - `asset:statistics` - Real-time asset storage metrics
- Enhanced main process integration (`index.ts`)
  - Registered asset IPC handlers during application initialization
  - Added error handling and response standardization
  - Integrated with existing project state management
- Extended preload script with asset management API (`preload.ts`)
  - Exposed secure asset operations to renderer process
  - Type-safe IPC method definitions
  - Proper error handling and validation
- Enhanced ProjectFileManager integration
  - Added AssetManager initialization support
  - Database integration for asset metadata tracking
  - Project state synchronization with asset operations
- All IPC handlers include proper error handling and project state validation
  - Automatic project dirty state marking on asset modifications
  - Graceful degradation when no project is open
  - Comprehensive error messages and debugging support

[Phase 4.4] AssetManager Unit Tests
- Implemented comprehensive unit testing infrastructure
  - Configured Jest with TypeScript support and ts-jest preset
  - Created test utilities for image generation and hash validation
  - Set up test environment with 30-second timeout for asset operations
  - Added custom Jest matchers for SHA-256 hash validation
- Created extensive test coverage for AssetManager core functionality (`AssetManager.test.ts`)
  - Asset storage and retrieval tests (7 test cases)
  - Hash-based deduplication verification
  - Thumbnail generation with dimension constraints
  - File validation and security checks
  - Directory structure creation and management
  - Reference counting simulation
  - Error handling for corrupt files and missing assets
- Test categories implemented:
  - Initialization and Configuration (3 tests)
  - Asset Storage and Retrieval (5 tests)
  - Deduplication Logic (3 tests)
  - Thumbnail Generation (4 tests)
  - Database Operations (3 tests)
  - Reference Counting (3 tests)
  - Validation and Security (5 tests)
  - Cleanup Operations (4 tests)
  - Batch Operations (3 tests)
  - Error Handling (5 tests)
  - Edge Cases (6 tests)
- All tests passing with proper cleanup and isolation
  - Each test uses unique temporary directories
  - Automatic cleanup prevents test interference
  - Sharp image processing fully tested with various formats
  - SHA-256 hash consistency verified across operations

[Phase 4.3] AssetManager Implementation
- Created comprehensive AssetManager class (`src/main/services/AssetManager.ts`)
  - Content-addressable storage using SHA-256 hashes
  - Automatic thumbnail generation with configurable dimensions
  - Deduplication through hash-based storage
  - Reference counting for safe asset cleanup
  - Batch import capabilities for multiple assets
- Core features implemented:
  - `storeAsset()` - Store images with automatic deduplication
  - `getAssetPath()` - Retrieve asset file paths with access tracking
  - `deleteAsset()` - Safe deletion with reference counting
  - `cleanupOrphans()` - Remove unreferenced assets
  - `importAssets()` - Batch import with progress tracking
  - `getStatistics()` - Asset storage metrics
- Security and validation:
  - File type validation (JPEG, PNG, WebP, GIF)
  - File size limits (default 50MB)
  - Dimension constraints (configurable min/max)
  - Corrupt file detection
- Successfully tested all features:
  - Asset storage and retrieval working
  - Deduplication correctly detecting identical files
  - Thumbnails generating at 200x200 default size
  - Reference counting preventing premature deletion
  - Batch import with duplicate detection

[Phase 4.2] Database Schema Migration
- Implemented comprehensive database migration system in ProjectFileManager
  - Added `migrateDatabase()` method for automatic schema updates
  - Created `getSchemaVersion()` and `applyMigration()` for version tracking
  - Migration runs automatically on project open and creation
- Added asset management database schema
  - New columns in products table: image_hash, thumbnail_hash, images_hashes
  - New assets metadata table for tracking stored assets
  - Performance indexes on ref_count and last_accessed for efficient queries
- Successfully tested migration on both new and existing projects
  - Backward compatible - existing projects automatically upgraded
  - Non-destructive migration preserves all existing data
  - Verified all asset columns and tables created correctly

[Phase 4.1] Asset Management System Prerequisites
- Installed and configured image processing dependencies
  - `sharp@0.33.5` for image manipulation and thumbnail generation
  - `@types/sharp@0.31.1` for TypeScript type definitions
  - Successfully rebuilt native modules for Electron compatibility
- Enhanced project structure for asset management
  - Added `assets/thumbnails/` subdirectory to project structure
  - Created comprehensive asset type definitions (`src/main/types/asset.types.ts`)
  - Extended Product interface with asset hash fields (imageHash, thumbnailHash, imagesHashes)
  - Updated Manifest interface with asset statistics tracking
- Prepared foundation for content-addressable storage system
  - Defined AssetResult, AssetMetadata, and AssetStorageOptions interfaces
  - Created AssetError class for specialized error handling
  - Established validation settings and cleanup options structures

[Phase 4.0] API Handlers with Field Mappings
- Updated API handlers to use consistent field mappings
  - Corrected database field name mappings in all CRUD operations
  - Enhanced type safety between database and API layers
  - Fixed product data structure inconsistencies

[Phase 3.0] TypeScript Interface Consistency
- Standardized TypeScript interfaces across the application
  - Aligned interfaces with database schema
  - Enhanced type safety throughout the codebase
  - Fixed interface inconsistencies between components

[Phase 2.0] ProjectFileManager Updates
- Enhanced ProjectFileManager with asset management capabilities
  - Added database migration system for schema updates
  - Integrated asset storage and retrieval functionality
  - Enhanced project structure creation

[Phase 1.0] Database Schema Standardization (Foundation)
- Implemented comprehensive database schema consistency updates
  - Phase 0: Standardized database field naming conventions
  - Phase 1: Updated ProjectFileManager with consistent field mappings
  - Phase 2: Enhanced TypeScript interfaces for data consistency
  - Phase 3: Updated API handlers with proper field mappings
- Fixed database column naming inconsistencies
  - Corrected `model_no` field references throughout the application
  - Standardized product data structure across database and API layers
  - Ensured consistent data flow from database through API to UI components

### Changed
- Updated ProjectFileManager.createProjectStructure() to include thumbnails directory
- Extended project.types.ts with asset management fields while maintaining backward compatibility
- Updated implementation-order.md to mark Phase 3 as complete
- Enhanced Phase 4 documentation from basic outline to comprehensive implementation guide
- Refined project state management architecture with ElectronProjectContext
- Improved API service architecture to use IPC instead of HTTP

### Fixed
- Project state synchronization between main and renderer processes
- Automatic window title updates reflecting project name and dirty state
- Navigation flow when projects are opened/closed
- API compatibility layer maintains existing component interfaces

## [0.1.s0] - Initial Release

### Added
- Phase 1: Project File Manager Core implementation
  - `.specbook` project file structure
  - SQLite database with proper schema
  - Project creation and validation
  - CRUD operations for products, categories, locations
  
- Phase 2: Complete Project Management & Desktop UX
  - File menu with keyboard shortcuts (Cmd+N, Cmd+O, Cmd+S)
  - Recent projects menu with persistence
  - Native file dialogs for project operations
  - Project state management
  - Unsaved changes handling with user prompts
  
- Core Electron application architecture
  - TypeScript configuration for main and renderer processes
  - React 19.1 with Vite for renderer
  - Better-SQLite3 for database operations
  - Electron Store for settings persistence
  - IPC communication layer
  - Security-focused preload script

- Desktop application features
  - Native menu bar integration
  - Window management and titles
  - File associations preparation
  - Cross-platform build configuration

### Technical Details
- **Architecture**: Electron 37.2.4 with React 19.1 and TypeScript 5.8.3
- **Database**: Better-SQLite3 with WAL mode for better concurrency
- **Build System**: Vite for renderer, TypeScript compiler for main process
- **State Management**: React Context API with centralized project state
- **Security**: Contextual preload script with minimal API surface
