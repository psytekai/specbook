# Code Conventions

## TypeScript/React
- Strict TypeScript with `@types` packages
- Functional components with hooks
- Context API for state management
- CSS modules for component styling
- Props interfaces for type safety
- ESLint + React hooks rules

## Python
- Pydantic models for all data structures
- Type hints throughout
- Structured error handling with custom error classes
- Clean API imports pattern
- Comprehensive validation at boundaries

## File Organization
- Component co-location (Component.tsx, Component.css, index.ts)
- Barrel exports from index.ts files
- Services in dedicated directories
- Shared types in dedicated files

## Asset Management
- Content-addressable storage using SHA-256 hashes
- Automatic thumbnail generation
- Reference counting for cleanup
- Database metadata storage