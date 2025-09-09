# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

- Complete Phase 3 API Integration & Error Handling implementation
  - IPC-based API service replacing HTTP mock API (`src/renderer/services/apiIPC.ts`)
  - Comprehensive API route handlers (`src/main/ipc/apiHandlers.ts`)
  - Enhanced preload script with direct IPC methods (`src/main/preload.ts`)
  - Project state management with automatic navigation (`src/renderer/contexts/ElectronProjectContext.tsx`)
  - "No Project Open" component with recent projects and keyboard shortcuts (`src/renderer/components/NoProjectOpen/NoProjectOpen.tsx`)
  - Window title updates with dirty state indicator (`•`)
  - Full project lifecycle management (create, open, save, close)
  - Recent projects tracking with persistent storage
  - Error handling for API operations without open project
  - Graceful degradation for categories/locations when no project is open

- Enhanced Phase 4 Asset Management System documentation
  - Comprehensive implementation plan with prerequisites
  - Database schema migration strategy
  - Security and validation requirements
  - Integration points with existing architecture
  - Detailed validation criteria (12 checkpoints)

### Changed

[Phase 4.1]
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

## [1.0.0] - Initial Release

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