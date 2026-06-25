# NGO Hub

NGO Management Platform — built module by module.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- PostgreSQL via **Supabase** (production) or local Postgres (development)
- Prisma ORM with `@prisma/adapter-pg`
- Custom JWT auth (httpOnly cookies) with refresh tokens
- Optional Supabase JS client for storage / realtime
- RBAC for roles: Admin, Manager, Accountant, HR, Coordinator, Staff

## Quick start (local)

### 1. Start the database

**Option A — Prisma local Postgres (recommended for dev):**

```bash
npx prisma dev
```

Keep this running. It updates `DATABASE_URL` in `.env` automatically.

**Option B — Your own PostgreSQL:**

Copy `.env.example` to `.env` and set `DATABASE_URL` and `DIRECT_DATABASE_URL`.

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

## Production (Supabase)

### 1. Create a Supabase project

1. [supabase.com](https://supabase.com) → New project
2. **Database → Network** → allow all IPs (`0.0.0.0/0`) so your host can connect
3. **Connect → Pooler → Session mode** (port **5432**) — copy the URI  
   User must be `postgres.[project-ref]`, not `postgres` alone
4. **Project Settings → API** — copy `URL` and `anon` key for optional JS client

### 2. Push schema and seed (from your machine)

```bash
npm run setup:production-db -- "postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

This validates the connection, runs `prisma db push`, seeds demo users, and prints production env vars (with fresh JWT secrets).

Or print env vars only:

```bash
npm run print:production-env -- "<session-pooler-uri>" "https://your-domain.com"
```

### 3. Verify connectivity

```bash
# Postgres (set DATABASE_URL in .env first)
npm run check:database

# Supabase REST API (optional)
npm run check:supabase
```

Health endpoint after deploy: `GET /api/health`

### Required environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase session pooler URI (port 5432) |
| `DIRECT_DATABASE_URL` | Same as `DATABASE_URL` |
| `JWT_ACCESS_SECRET` | Random secret (32+ bytes) |
| `JWT_REFRESH_SECRET` | Random secret (32+ bytes) |
| `NEXT_PUBLIC_APP_URL` | Public URL, e.g. `https://your-domain.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional — `https://[ref].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional — from Supabase API settings |

URL-encode special characters in the database password (`@` → `%40`, `#` → `%23`).

## Deploy on Hostinger (Node.js)

1. Push this repo to GitHub (see below)
2. Hostinger → **Websites** → **Add Website** → **Node.js**
3. Connect your GitHub repo
4. Build settings:
   - **Build command:** `npm run build`
   - **Start command:** `npm run start` (uses root `server.js`, binds `0.0.0.0` + `PORT`)
   - **Node version:** 20+
5. Add all environment variables from the production setup step
6. Deploy and open `/api/health` — `database.ok` and `status` should be `"ok"`

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/refresh` | Rotate session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/health` | Database + Supabase health |
| GET | `/api/users` | List users (Admin) |
| POST | `/api/users` | Create user (Admin) |

## Roadmap

- Tab 2: Users & Organization
- Tab 3: Projects & Programs
- Tab 4: Beneficiaries
- Tab 5: Finance
- Tab 6: HR & Attendance
- Tab 7: Reports
