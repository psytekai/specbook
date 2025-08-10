# SpecBook Manager - Electron Desktop App

A desktop application for managing architectural projects and product information.

## Features

- **Project Management**: Create and manage multiple architectural projects
- **Product Scraping**: Add products with URL scraping functionality
- **Intuitive UI**: Modern React-based interface with sidebar navigation
- **Cross-platform**: Works on Mac, Windows, and Linux

## Development Setup

### Prerequisites

- Node.js 16+ and npm
- Chrome/Chromium browser (for development)

### Installation

```bash
cd electron-app
npm install
```

### Running in Development

```bash
npm run dev
```

This will:
1. Start the Vite development server on http://localhost:5173
2. Launch the Electron app with hot reload enabled

### Building

```bash
# Build for development
npm run build

# Create distributable packages
npm run dist        # All platforms
npm run dist:mac    # macOS only
npm run dist:win    # Windows only
npm run dist:linux  # Linux only
```

## Project Structure

```
electron-app/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React app (renderer process)
│   │   ├── components/ # React components
│   │   ├── contexts/   # React contexts
│   │   ├── pages/      # Page components
│   │   ├── services/   # API services
│   │   └── types/      # TypeScript types
│   └── shared/         # Shared between processes
├── dist/               # Build output
└── public/             # Static assets
```

## Available Scripts

- `npm run dev` - Start development environment
- `npm run build` - Build for production
- `npm run dist` - Create distributables
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint

## Usage

1. **Create a Project**: On first launch, create your first project
2. **Select Project**: Use the dropdown on the home page to select a project
3. **Add Products**: Click "Add a Product" to scrape product information
4. **Manage Projects**: Navigate to Projects page to edit project names
5. **View Settings**: Access settings for future configuration options

## Technical Stack

- **Electron**: Desktop application framework
- **React 19.1**: UI library with hooks
- **TypeScript**: Type safety and better DX
- **Vite**: Fast build tool
- **React Router**: Navigation
- **Context API**: State management

## API Implementation Notes

### Product Locations API
**TODO**: The following API endpoints need to be implemented on the backend:

1. **GET /api/locations**
   - Returns a list of available product locations
   - Currently returns mock data from `src/renderer/services/api.ts`
   - Expected response format:
   ```json
   {
     "locations": ["Living Room", "Kitchen", "Bedroom", ...]
   }
   ```

2. **POST /api/locations**
   - Creates a new product location
   - Request body:
   ```json
   {
     "location": "New Location Name"
   }
   ```
   - Expected response:
   ```json
   {
     "success": true,
     "location": "New Location Name"
   }
   ```

The mock implementation can be found in:
- `fetchProductLocations()` in `src/renderer/services/api.ts`
- `addProductLocation()` in `src/renderer/services/api.ts`

### Products API
**TODO**: Implement proper backend endpoints for:
- GET /api/projects/:projectId/products
- POST /api/products
- GET /api/products/:productId

Currently using in-memory mock storage.