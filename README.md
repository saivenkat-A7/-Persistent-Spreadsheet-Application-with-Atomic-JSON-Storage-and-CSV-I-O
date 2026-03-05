# Spreadsheet Persistence API

A backend REST API for a spreadsheet application with **atomic JSON storage** and **CSV import/export**, built with Node.js and Express, fully containerized with Docker.

---

## Architecture Overview


The system architecture features a layered design, effectively decoupled for integration testing.

```mermaid
graph TD
    Client((Client))

    %% Application Layer
    subgraph App[Express Application]
        Router[Express Router]
        Controller[Sheet Controller]
    end

    %% Service Layer
    subgraph Services[Service Layer]
        StorageSvc[Storage Service]
        CSVSvc[CSV Service]
    end

    %% File System
    subgraph FS[File System Data Store]
        JSONFiles[(Sheet JSON Files)]
        TempFiles>Temporary Atomic Writes]
    end

    %% Data Flow
    Client -- "HTTP Requests" --> Router
    Router -- "Routes to Actions" --> Controller
    Controller -- "Uses" --> StorageSvc
    Controller -- "Parses/Formats" --> CSVSvc
    
    %% Storage Flow
    StorageSvc -- "Writes to Temp File" --> TempFiles
    TempFiles -- "Atomic Rename" --> JSONFiles
    StorageSvc -- "Reads directly" --> JSONFiles
``` 


**Key Design Decisions:**
- **Atomic Writes**: New data is written to a `.tmp` file first, then renamed to the final path. `rename()` is atomic at the OS level, so the original file is never corrupted.
- **Formula Safety**: Formulas are evaluated using a regex-based parser — never `eval()` — preventing code injection.
- **Docker Volumes**: The `app_data/` directory is mounted into the container, so data persists across container restarts.

---

## Quick Start

### Prerequisites
- Docker & Docker Compose

### Run with Docker (recommended)
```bash
# Clone and enter the project
git clone <repo-url>
cd spreadsheet-app

# Start the application
docker-compose up --build

# App is running at http://localhost:3000
```

### Run locally (for development)
```bash
cp .env.example .env
# Edit .env if needed, then:
npm install
npm start
```

---

## Environment Variables

See `.env.example`:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `DATA_STORAGE_PATH` | `/app/data` | Directory for JSON sheet files |

---

## API Reference

### Health Check
```
GET /health
→ 200 { "status": "ok" }
```

### Save Sheet State (Atomic)
```
PUT /api/sheets/:sheetId/state
Content-Type: application/json

Body: { "cells": { "A1": "Hello", "B1": "=10+5" } }
→ 204 No Content
```

### Load Sheet State
```
GET /api/sheets/:sheetId/state
→ 200 { "cells": { ... } }
→ 404 if sheet not found
```

### Import CSV
```
POST /api/sheets/:sheetId/import
Content-Type: multipart/form-data
Field: file (CSV file)

→ 204 No Content
```
Formulas (values starting with `=`) are stored as strings.

### Export CSV
```
GET /api/sheets/:sheetId/export
→ 200 text/csv (formulas are evaluated to computed values)
→ 404 if sheet not found
```

---

## Testing
```bash
npm test
```

---

## Verify Data Persistence
```bash
docker-compose up -d
# Save some data:
curl -X PUT http://localhost:3000/api/sheets/test/state \
  -H "Content-Type: application/json" \
  -d '{"cells": {"A1": "Persisted!"}}'

docker-compose down
docker-compose up -d

# Data should still be there:
curl http://localhost:3000/api/sheets/test/state
```
