# NGO Hub

NGO Management Platform — built module by module.

## Tab 1: Auth + Setup (current)

- Next.js 14 (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma
- JWT auth (httpOnly cookies) with refresh tokens
- RBAC for 5 roles: Admin, Manager, HR, Coordinator, Staff

## Quick start

### 1. Start the database

**Option A — Prisma local Postgres (recommended for dev):**

```bash
npx prisma dev
```

Keep this running in a terminal. It updates `DATABASE_URL` in `.env` automatically.

**Option B — Your own PostgreSQL:**

Set `DATABASE_URL` in `.env` to your connection string.

### 2. Apply schema and seed

```bash
npm run db:push
npm run db:seed
```

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ngohub.local | Admin@123 |
| Manager | manager@ngohub.local | Manager@123 |
| HR | hr@ngohub.local | Hr@123 |
| Coordinator | coordinator@ngohub.local | Coord@123 |
| Staff | staff@ngohub.local | Staff@123 |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/refresh` | Rotate session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/users` | List users (Admin) |
| POST | `/api/users` | Create user (Admin) |

## Roadmap

- Tab 2: Users & Organization
- Tab 3: Projects & Programs
- Tab 4: Beneficiaries
- Tab 5: Finance
- Tab 6: HR & Attendance
- Tab 7: Reports
