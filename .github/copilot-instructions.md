# Global People Tracker instructions

## Architecture

Use a React, TypeScript, and Vite frontend in `frontend/`. Use a Python FastAPI
backend in `backend/`. Future application data is private and must be scoped to
the authenticated internal user UUID; never authorize from a frontend-supplied user ID.

## Commands

Run these commands from the repository root:

- Install backend dependencies: `python -m pip install -r backend/requirements.txt`
- Run backend: `python -m uvicorn app.main:app --app-dir backend --reload`
- Test backend: `python -m pytest backend`
- Lint backend: `python -m ruff check backend`
- Format-check backend: `python -m ruff format --check backend`
- Typecheck backend: `python -m pyright --project backend`
- Build-check backend: `python -m compileall -q backend/app`
- Install frontend dependencies: `npm --prefix frontend ci`
- Run frontend: `npm --prefix frontend run dev`
- Test frontend: `npm --prefix frontend test`
- Lint frontend: `npm --prefix frontend run lint`
- Format-check frontend: `npm --prefix frontend run format:check`
- Typecheck frontend: `npm --prefix frontend run typecheck`
- Build frontend: `npm --prefix frontend run build`

## Coding requirements

Keep TypeScript and Python typing strict. Avoid `any` unless unavoidable at a
third-party boundary, and convert loose third-party data to typed application
models immediately. Prefer conventional, readable implementations over clever
or unnecessary abstractions. Stop at every project-plan milestone boundary for
human review; do not begin the next milestone without approval.
