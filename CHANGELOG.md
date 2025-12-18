# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.1] - 2025-12-18

### Fixed

- Product not found due to paginated api

## [1.2.0] - 2025-10-12

### Updated

- [P1] add export configuration to remove pagination
- [P2] export default file save as name: [export date] - [project name]_specBook - [issuance name]
- [P3] default to landscape for exporting

### Fixed

- [P1] bug: landscape view breaks cover page rendering
- [P2] bug: url column padding not allowing url to take up more space

## [1.1.0] - 2025-10-05

### Updated
- [P1] sort by tag id (in pdf export)
- [P1] add cover page to pdf export
- [P1] add project info page via application menu and updated project manifest with inputted information
- [P1] add option to pdf export with full link (ideally as jpeg)
- [P2] add vertical lines to separate columns
- [P2] default to “Letter” page format
- [P3] add option to page break between groups on export

### Removed
- [P1] re-order/fix column priority in export: image, tag, type, manufacturer, description, model_no, location, url
- [P1] remove metadata from pdf export [in the top right corner]
- [P2] remove pdf export title
- [P2] remove grouping count in export
- [P2] remove ending blank pages and fix page numbers

### Fixed
- [P1] [bug] images are exceeded column width
- [P1] [bug] not using full quality images (using thumbnails)
- [P1] [bug] group by category or location should be case insensitive

## Product Enhancements

### Updated
- [P1] add model_no field to new product workflow, product page, product table (hidden by default), and to export
- [P1] update project page header to the product title, where product title = `<tag> <manufacturer> <type>`
- [P1] notify/warn/alert/message for duplicate tags (warning on new product/export, red text styling on product table)
- [P2] rename specification to description on product page
- [P2] UI updated: centered product new/project page action buttons and centered bread crumbs on product page

### Removed
- [P2] remove product name product page
- [P2] remove product name from product table

## Other Bug Fixes

### Fixes

- [P1] [bug] bulk delete if corrupting manifest file - manifest file writes not concurrency-safe
- [P2] filter search removes focus after each key


## [1.0.0] - 2025-09-29

### Added

#### Product Management
- Complete CRUD operations for products with validation
- Tag-based product organization system
- Bulk product operations with multi-select and bulk delete
- Product search, filtering, and sorting capabilities
- Table pagination for efficient data viewing
- CSV import/export functionality
- PDF export with proper formatting and metadata

#### Web Scraping Integration
- Python-powered web scraping engine bundled as PyInstaller executables
- Automatic product data extraction from URLs
- Real-time progress tracking during scraping operations
- Multi-tier fallback scraping strategy (requests → Selenium → Firecrawl)
- Intelligent HTML processing and content extraction
- LLM-powered data extraction with structured output

#### Asset Management System
- Content-addressable storage using SHA-256 hashes
- Automatic image deduplication (40% storage reduction)
- Automatic thumbnail generation with configurable dimensions
- Reference counting for safe asset deletion
- Batch asset import with progress tracking
- Secure `asset://` protocol for serving stored assets
- Support for JPEG, PNG, WebP, and GIF formats

#### Category & Location Management
- Full CRUD operations for categories and locations
- ID-based reference system with automatic cleanup
- Inline editing and deletion with confirmation dialogs
- Optional category/location assignment for products
- Automatic migration from name-based to ID-based references

#### Project File System
- `.specbook` project file format with SQLite database
- Comprehensive database schema with automatic migrations
- Project-level asset storage and management
- Recent projects menu with keyboard shortcuts
- Unsaved changes detection and user prompts
- Native file dialogs for project operations

#### Desktop Application Features
- Native menu bar with keyboard shortcuts (Cmd+N, Cmd+O, Cmd+S, etc.)
- Cross-platform support (macOS and Windows)
- Window state management and persistence
- Toast notification system for user feedback
- Secure API key management interface
- Project-specific settings and preferences

#### Testing Infrastructure
- Jest with TypeScript support for comprehensive unit tests
- Test utilities for image generation and validation
- Custom matchers for hash validation
- 44+ tests with full coverage for asset management

### Changed

- React framework upgraded to 19.0 with TypeScript 5.8.3
- Electron runtime upgraded to 37.2.4
- Database uses Better-SQLite3 with WAL mode for improved concurrency
- Build system uses Vite for fast development and optimized builds
- Styling updated to CSS modules with responsive design

### Technical Details

#### Frontend Stack
- React Router v6 for navigation
- React Context API for state management (ProjectContext, ToastContext)
- TypeScript strict mode for compile-time type checking
- Hot module replacement with Vite

#### Backend Stack
- Better-SQLite3 database with WAL mode
- Sharp for image processing and thumbnail generation
- PyInstaller bundles for cross-platform Python scraping engine
- Electron Store for settings persistence

#### Python Backend Services
- Multi-method scraping fallback with Selenium and Firecrawl
- OpenAI API integration for intelligent data extraction
- Comprehensive metrics collection and error tracking
- Model comparison and performance testing
- 3-layer cache system (memory → file → SQLite)

#### Security & Validation
- Contextual preload script with minimal API surface
- Secure IPC communication between main and renderer processes
- Pydantic models for type-safe Python data structures
- File type and size validation for uploads
- Dimension constraints for image assets

#### Distribution & Build System
- GitHub Actions CI/CD for automated builds
- Separate Windows and macOS build pipelines
- Native module pre-building for consistent deployments
- Standalone executables with embedded Python scraping engine (40-60MB)
- Pre-compiled native modules (better-sqlite3, sharp)

[unreleased]: https://github.com/orpheus/specbook/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/orpheus/specbook/releases/tag/v1.0.0
