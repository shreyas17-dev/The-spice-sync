# BiteRoute: Smart Multi-Vendor Food Delivery & Logistics Management System

A DBMS mini project. Customers order food from many restaurants, owners manage orders and menus,
delivery partners carry orders with live tracking, and admins run the platform.

| Part | Technology |
|---|---|
| Relational database | MySQL 8.0 (tables, CHECK constraints, views, functions, procedures, triggers, roles) |
| NoSQL database | Redis 7 API (Memurai on Windows): GEO, Streams, Pub/Sub, hashes, lists, TTL, ACL users |
| Web app | Next.js 14 (App Router) + TypeScript + Tailwind CSS, Leaflet maps |
| Login | JWT in an httpOnly cookie, scrypt password hashes, sessions in Redis |

## Run it on Windows

You need **MySQL Server 8.0**, **Memurai** (or any Redis 6.2+) and **Node.js 18.17+**.

1. Double-click **`setup-database.bat`** and type your MySQL root password.
   It builds the `food_delivery` database: 15 tables, views, functions, procedures, triggers,
   4 roles with their app accounts, and about 4,700 rows of sample data.
2. Double-click **`setup-redis.bat`**. It creates the Redis users and loads the live sample data
   (rider positions, order streams, carts, notifications).
3. Double-click **`start.bat`**. The first time it installs the npm packages (a few minutes),
   then it starts the app. Open **http://localhost:3000**.

Logs from each step are written to the `logs` folder.

## Demo accounts (password `Password@123` for all)

| Role | Email |
|---|---|
| Customer | aditya.rao@example.com |
| Restaurant owner | imran.sheikh@example.com (Biryani Bhavan, Punjab Da Dhaba) |
| Delivery partner | suresh.naik3@example.com |
| Admin | priya.raghavan@biteroute.example |

The login page has a button that fills in the demo account for the chosen role.

## A full demo in four browser windows

1. **Customer**: pick an address, open Biryani Bhavan, add dishes, apply `BIRYANI15`, place the order.
2. **Owner** (another browser or a private window): Live orders → Accept. The nearest free rider is
   assigned (Redis GEOSEARCH gives a shortlist, the stored procedure decides). Then Start preparing → Mark ready.
3. **Rider**: the task appears. Press *Simulate ride*: the location is sent every 2 seconds and the
   customer's tracking map moves live (Redis Streams + Pub/Sub + Server-Sent Events).
   Press *Picked up*, then *Mark as delivered*.
4. **Customer**: rate the order. **Admin**: see the order in the overview and the actions in the activity log.

## Folders

```
database/   01_schema.sql ... 10_advanced_demo.sql, setup_all.sql, gen_seed.py (sample data generator)
redis/      01_setup.redis (ACL users), 02_seed.redis (live data), 03_rud_examples.redis
app/        pages for each role, and app/api/* route handlers (the backend)
components/ shared UI (navigation, map, charts)
lib/        db.ts (one MySQL pool per role), redis.ts, auth.ts, api.ts
middleware.ts   role guard for /owner, /partner, /admin and customer pages
scripts/    PowerShell used by the .bat files
```

## How access control works

* **Pages**: `middleware.ts` checks the role in the signed cookie before a page loads.
* **API**: every route calls `requireRole(...)`.
* **MySQL**: the API connects with a different MySQL account per role (`fd_app_customer`, `fd_app_owner`,
  `fd_app_partner`, `fd_app_admin`), each limited by a role in `database/06_roles.sql`
  (column-level grants, views, EXECUTE on procedures only).
* **Redis**: the API uses ACL user `fd_api`; the live tracking stream uses the read-only `fd_tracking`.

## Manual setup (any OS)

```
mysql -u root -p -e "source database/setup_all.sql"     # run from this folder
redis-cli < redis/01_setup.redis    (strip lines starting with # first)
redis-cli < redis/02_seed.redis
copy .env.example .env.local        # then edit if needed
npm install
npm run dev
```
