# Project Overview: TheranchMine Phase1 Specbook

## Purpose
Scalable PRP (Pipeline Requirements Plan) execution platform with both Python backend services and an Electron desktop application for architectural product management.

## Tech Stack
- **Frontend**: Electron app with React 19.1, TypeScript, Vite
- **Backend**: Python 3.8+ with FastAPI, Pydantic models
- **Database**: Better SQLite3 for local storage
- **UI**: React Router v6, Context API for state management
- **Image Processing**: Sharp for thumbnails, content-addressable storage
- **Scraping**: Multi-tier fallback (requests → Selenium → Firecrawl)

## Key Architecture
- Electron main process handles file system, IPC, security
- React renderer process for UI
- AssetManager service for content-addressable image storage
- Project file-based system with `.specbook` directories
- Real-time monitoring and benchmarking capabilities