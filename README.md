# StudySprint

A full-stack web app for planning daily goals, managing study work in bulk, and reviewing progress metrics over time.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express

## Monorepo Structure
- `frontend/` React app
- `backend/` Node.js API

## Current Features
- Create, edit, delete, archive, pin, and complete study goals
- Filter, sort, search, and paginate goal lists
- Review overview metrics such as completion rate, overdue counts, pinned counts, and on-time completion stats
- Run bulk actions for today, overdue, completed, archived, and pinned goal groups
- Import and export goal data as JSON

## API Highlights
- `GET /api/goals` for filtered goal lists with pagination
- `GET /api/goals/stats` for overview metrics
- `GET /api/goals/today` and `GET /api/goals/upcoming` for short-term planning views
- `POST /api/goals/import` and `GET /api/goals/export` for data portability
