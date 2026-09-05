# Global People Tracker

A mobile-first web application for tracking people met throughout travels and life.

## Prerequisites

- Python 3.12
- Node.js 22

## Development commands

Run commands from the repository root.

### Backend

```sh
python -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --reload
backend/.venv/bin/python -m pytest backend
backend/.venv/bin/python -m ruff check backend
backend/.venv/bin/python -m ruff format --check backend
backend/.venv/bin/python -m pyright --project backend
backend/.venv/bin/python -m compileall -q backend/app
```

### Frontend

```sh
npm --prefix frontend ci
npm --prefix frontend run dev
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run format:check
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

## Dependency management

Frontend dependencies are locked in `frontend/package-lock.json`. Backend direct
dependencies are recorded in `backend/requirements.in`; the fully pinned
`backend/requirements.txt` is the installable lockfile. Update it only by
creating a clean Python 3.12 virtual environment, installing
`requirements.in`, and freezing the result.