# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This is the backend directory for the TRM Specbook Manager project. The backend is currently being set up to integrate with the existing Phase 1 Specbook system located in the parent directory (`../`).

## Common Development Commands

### Backend Setup
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies (when requirements.txt is populated)
pip install -r requirements.txt

# Database migrations (when models are implemented)
alembic upgrade head
alembic revision --autogenerate -m "Description of changes"

# Run development server (when main.py is created)
uvicorn app.main:app --reload --port 8000
```

### Testing
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/api/test_endpoints.py

# Run tests with verbose output
pytest -v
```

### Parent Project Integration
```bash
# Access the main project's scraping and LLM functionality
cd ..
python workspace/scripts/specbook_monitored.py
python verification_ui.py
```

## Architecture Overview

### Backend Structure (To Be Implemented)

The backend follows a FastAPI architecture with the following structure:

```
backend/
├── app/
│   ├── api/           # API endpoints
│   │   └── v1/        # API version 1
│   │       └── endpoints/  # Route handlers
│   ├── core/          # Core functionality (config, security)
│   ├── models/        # SQLAlchemy/Pydantic models
│   ├── schemas/       # Request/response schemas
│   ├── services/      # Business logic
│   └── utils/         # Utility functions
├── alembic/           # Database migrations
│   └── versions/      # Migration files
└── tests/             # Test suite
    ├── api/           # API tests
    ├── models/        # Model tests
    └── services/      # Service tests
```

### Integration with Parent Project

The parent directory contains the full Phase 1 Specbook system with:
- **lib/**: Core Python library for scraping, LLM processing, and monitoring
- **workspace/**: Active development scripts and notebooks
- **electron-app/**: Desktop application frontend
- **shared/**: Shared resources and cache

Key components to integrate:
```python
# Import from parent project's lib
import sys
sys.path.append('..')
from lib.core import StealthScraper, HTMLProcessor, LLMInvocator
from lib.monitoring import PipelineMonitor
from lib.benchmarking import ExperimentRunner
```

### Environment Configuration

Create a `.env` file based on `.env.example`:

**Required Variables:**
- `DATABASE_URL`: Database connection string
- `SECRET_KEY`: JWT secret key (generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- `OPENAI_API_KEY`: For LLM integration (same as parent project)
- `FIRECRAWL_API_KEY`: Optional, for fallback scraping

**API Configuration:**
- `API_V1_STR`: API prefix (default: "/api/v1")
- `BACKEND_CORS_ORIGINS`: Allowed CORS origins for Electron app

## Development Patterns

### API Endpoint Pattern
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import ResponseSchema, RequestSchema
from app.services import ServiceClass

router = APIRouter()

@router.post("/endpoint", response_model=ResponseSchema)
async def endpoint_handler(
    request: RequestSchema,
    db: Session = Depends(get_db)
):
    service = ServiceClass(db)
    result = await service.process(request)
    return result
```

### Service Layer Pattern
```python
class SpecbookService:
    def __init__(self, db: Session):
        self.db = db
    
    async def process_urls(self, urls: List[str]):
        # Integrate with parent project's scraping
        from lib.core import StealthScraper
        scraper = StealthScraper()
        results = []
        for url in urls:
            result = await scraper.scrape_url(url)
            results.append(result)
        return results
```

### Database Models Pattern
```python
from sqlalchemy import Column, Integer, String, DateTime
from app.database import Base

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True, index=True)
    image_url = Column(String)
    type = Column(String)
    description = Column(String)
    model_no = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
```

## Key Integration Points

### 1. Scraping Pipeline Integration
- Use `lib.core.StealthScraper` for web scraping
- Use `lib.core.HTMLProcessor` for HTML cleaning
- Use `lib.core.LLMInvocator` for extraction

### 2. Monitoring Integration
- Use `lib.monitoring.PipelineMonitor` for tracking
- Store metrics in database for API access

### 3. Electron App API
The Electron app expects these endpoints:
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/{id}` - Get project details
- `POST /api/v1/projects/{id}/scrape` - Run scraping pipeline
- `GET /api/v1/projects/{id}/results` - Get results

### 4. Authentication & Security
- JWT-based authentication
- Rate limiting per user/API key
- CORS configuration for Electron app
- Request validation with Pydantic

## Testing Strategy

### Unit Tests
- Test services with mocked dependencies
- Test models and schemas validation
- Test utility functions

### Integration Tests
- Test API endpoints with test database
- Test integration with parent project's lib
- Test authentication flow

### End-to-End Tests
- Test full pipeline from URL input to results
- Test Electron app integration
- Test error handling and recovery

## Deployment Considerations

### Development
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production
- Use Gunicorn with Uvicorn workers
- Set up proper logging and monitoring
- Use PostgreSQL or MySQL instead of SQLite
- Enable HTTPS with proper certificates
- Configure rate limiting and security headers
- Set up automated backups

## Next Steps for Implementation

1. **Create main.py** with FastAPI application
2. **Implement database.py** for SQLAlchemy setup
3. **Create core models** in models/
4. **Define API schemas** in schemas/
5. **Implement service layer** integrating with parent lib
6. **Create API endpoints** in api/v1/endpoints/
7. **Write comprehensive tests**
8. **Set up CI/CD pipeline**

## Notes

- The backend should leverage the existing functionality in the parent project's `lib/` directory
- Maintain consistency with the data models defined in the parent project
- Follow the error handling patterns established in the parent project
- Use the same environment variables where applicable (OPENAI_API_KEY, etc.)