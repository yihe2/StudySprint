# StudySprint

A full-stack web app for planning daily goals, managing study work in bulk, and reviewing progress metrics over time.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express

## Monorepo Structure
- `frontend/` React app
- `backend/` Node.js API

## Getting Started
- Install backend dependencies: `cd backend && npm install`
- Install frontend dependencies: `cd frontend && npm install`
- Start the backend API: `cd backend && npm run dev`
- Start the frontend app: `cd frontend && npm run dev`

## Local Development Notes
- The frontend dev server proxies `/api` requests to `http://localhost:3001`
- Goal data is stored in `backend/data/goals.json`

## Current Features
- Create, edit, delete, archive, pin, and complete study goals
- Filter, sort, search, and paginate goal lists
- Review overview metrics such as completion rate, overdue counts, pinned counts, and on-time completion stats
- Run bulk actions for today, overdue, completed, archived, and pinned goal groups
- Import and export goal data as JSON

## Project Status
- Scope focus: daily goal planning, bulk management, and progress review metrics
- Current state: feature-complete for the core goal workflow and overview dashboard
- Not included: authentication, multi-user collaboration, and persistent focus-session tracking

## API Highlights
- `GET /api/goals` for filtered goal lists with pagination
- `GET /api/goals/stats` for overview metrics
- `GET /api/goals/today` and `GET /api/goals/upcoming` for short-term planning views
- `POST /api/goals/import` and `GET /api/goals/export` for data portability
