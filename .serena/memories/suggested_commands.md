# Suggested Commands

## Electron App Development
```bash
cd electron-app
npm install                    # Install dependencies
npm run dev                   # Development mode (Vite + Electron)
npm run type-check           # TypeScript checking
npm run lint                 # ESLint
npm run build               # Build both main and renderer
npm run dist                # Package for distribution
```

## Python Backend
```bash
pip install -r requirements.txt    # Install Python deps
python verification_ui.py          # Run verification UI
python workspace/scripts/specbook_monitored.py  # Run monitored pipeline
```

## Testing & Quality
```bash
npm test                    # Run Jest tests
npm run test:coverage      # Test coverage
python workspace/tests/test_*.py  # Python tests
```

## Project Structure
- `electron-app/src/main/` - Electron main process
- `electron-app/src/renderer/` - React app
- `electron-app/src/shared/` - Shared types
- `lib/` - Python core library
- `workspace/` - Active development area