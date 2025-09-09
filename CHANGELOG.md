# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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