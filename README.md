# Online Pharmacy Management Web System - Backend API

Production-ready, highly secure, and transactional REST API for an online pharmacy management platform built with **Node.js**, **Express**, and **MySQL 8.0** using pure SQL parameterized queries via `mysql2/promise` (without ORM).

---

## 1. Project Overview

The system models a full-scale pharmacy where:
- **Customers** register, log in, search and browse medicines (including live stock levels from non-expired batches), upload prescription scans, create multi-item orders, make payments, and view their order history.
- **Pharmacists** review customer prescriptions (approving or rejecting), monitor expiring and low-stock batches, replenish inventory, and manage order fulfillment workflows.
- **Admins** maintain complete control across the platform, including user role management, catalog categories, medicine profiles, and business analytics reports.

---

## 2. Requirements & Tech Stack

- **Operating System:** Windows 10/11
- **Runtime:** Node.js v20+ (tested on Node.js v26.3.0 and npm 11.16.0)
- **Database:** MySQL Server 8.0 (running locally on port 3306)
- **Framework:** Express.js (JSON REST API)
- **Database Driver:** `mysql2/promise` (raw parameterized queries with `?` placeholders)
- **Authentication:** JWT (`jsonwebtoken`) and password hashing with `bcryptjs` (salt cost 10)
- **Input Validation:** `joi`
- **File Upload:** `multer` (restricted to JPG/PNG/PDF up to 5 MB, randomized filenames)
- **Security:** `helmet`, `cors`, `express-rate-limit`

---

## 3. Database Architecture (Exactly 8 Tables)

The database schema strictly complies with the requirement of **exactly 8 tables**:

1. `users` - System actors (`customer`, `pharmacist`, `admin`).
2. `categories` - Pharmaceutical product classifications.
3. `medicines` - Drug catalog, prices, and prescription flags.
4. `batches` - Inventory lot allocations, quantities, and expiry dates.
5. `prescriptions` - Uploaded prescription images, review status, and reviewer reference.
6. `orders` - Customer purchase orders, delivery addresses, and statuses.
7. `order_items` - Line items referencing medicines and purchased unit prices.
8. `payments` - 1:1 financial records linked to orders.

For a complete schema diagram and structural definitions, see [docs/ERD.md](docs/ERD.md).

---

## 4. Setup & Installation on Windows

### Step 1: Open Terminal in Project Directory
Ensure PowerShell or Command Prompt is located at the project root:
```powershell
cd "c:\Users\Tirtha Bepary\Desktop\Jim_project"
```

### Step 2: Install Node Dependencies
```powershell
npm install
```

### Step 3: Configure Environment Variables
Create a `.env` file in the project root (you can copy `.env.example`):
```powershell
Copy-Item .env.example .env
```
Update `.env` with your MySQL server credentials:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=pharma_user
DB_PASSWORD=PharmaUser@2026
DB_NAME=pharmacy_db
JWT_SECRET=super_secret_pharmacy_jwt_key_2026_xyz
JWT_EXPIRES_IN=1d
```

> **Note:** The MySQL database user `pharma_user` must have full privileges on `pharmacy_db`.

### Step 4: Initialize and Seed the Database (ONE-TIME SETUP ONLY)
Run the automated schema creation and seeding script:
```powershell
npm run db:init
```
This runs `database/schema.sql` and `database/seed.sql` and verifies that exactly 8 tables are present.

> [!WARNING]
> **`npm run db:init` is a FACTORY RESET!**  
> It drops all tables and resets data back to the default 5 demo accounts.  
> **Only run it once** during initial installation or when you deliberately want a clean slate. **Do NOT run `npm run db:init` on daily startup**, or it will erase your newly registered users and custom orders.

### Step 5: Daily Server Startup (Persistent Data)
Whenever you start or restart your computer, your MySQL service (`MySQL80`) starts automatically in the background and preserves all your registered users. Simply run:
- **Development mode (recommended):**
  ```powershell
  npm run dev
  ```
- **Production mode:**
  ```powershell
  npm start
  ```
Once started, open **`http://localhost:5000`** in any web browser. Your registered accounts, orders, and uploaded prescriptions will persist permanently!

### Step 6: Verify System Health
Visit `http://localhost:5000/api/health` in your browser or run:
```powershell
curl http://localhost:5000/api/health
```
Expected response:
```json
{
  "success": true,
  "status": "OK",
  "database": "connected",
  "tableCount": 8,
  "expectedTables": 8,
  "tables": [
    "batches",
    "categories",
    "medicines",
    "order_items",
    "orders",
    "payments",
    "prescriptions",
    "users"
  ]
}
```

### Step 7: Run Automated Test Suite
To execute the comprehensive end-to-end integration test suite:
```powershell
npm test
```

---

## 5. Production Deployment

### Option A: Docker & Docker Compose (Recommended for Production)
The system includes a production-grade multi-stage [`Dockerfile`](Dockerfile) and [`docker-compose.yml`](docker-compose.yml):
```bash
# Build and run the MySQL 8 and Node.js containers in detached mode
docker compose up --build -d

# Check live logs
docker compose logs -f app

# Run health check
curl http://localhost:5000/health/ready
```

### Option B: PM2 Cluster Mode (Multi-Core Bare Metal / VM)
Using the included [`ecosystem.config.js`](ecosystem.config.js), PM2 will spawn an instance across all CPU cores with automatic memory restarts and zero-downtime reloads:
```bash
# Install PM2 globally (if not installed)
npm install -g pm2

# Start the cluster in production mode
pm2 start ecosystem.config.js --env production

# Monitor status and logs
pm2 status
pm2 logs
```

---

## 6. Seeded Test Accounts

All sample passwords use a bcrypt salt cost of 10:

| Role | Name | Email | Password |
|---|---|---|---|
| **Admin** | Admin User | `admin@pharmacy.com` | `AdminPassword123!` |
| **Pharmacist** | Dr. Sarah Khan | `pharmacist@pharmacy.com` | `PharmaPassword123!` |
| **Customer** | John Doe | `john.doe@example.com` | `CustomerPassword123!` |
| **Customer** | Jane Smith | `jane.smith@example.com` | `CustomerPassword123!` |
| **Customer** | Rahim Ahmed | `rahim.ahmed@example.com` | `CustomerPassword123!` |

---

## 6. API Endpoints Table

All endpoints are prefixed with `/api`.

| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | System status and database table count (must equal 8) |
| `POST` | `/api/auth/register` | Public (Rate-limited) | Register customer (role forced to `customer`) |
| `POST` | `/api/auth/login` | Public (Rate-limited) | Login; returns JWT and user payload |
| `GET` | `/api/auth/me` | Authenticated | Return authenticated user profile |
| `GET` | `/api/users` | Admin | List all registered users |
| `GET` | `/api/users/:id` | Admin | Retrieve user details by ID |
| `PATCH` | `/api/users/:id/role` | Admin | Change user role (`customer`, `pharmacist`, `admin`) |
| `DELETE` | `/api/users/:id` | Admin | Delete user (prevents self-deletion & foreign key conflicts) |
| `GET` | `/api/categories` | Public | List all medicine categories |
| `POST` | `/api/categories` | Admin | Create new category |
| `PUT` | `/api/categories/:id` | Admin | Update category name |
| `DELETE` | `/api/categories/:id` | Admin | Delete category (returns 409 if referenced) |
| `GET` | `/api/medicines` | Public | Search medicines with pagination, category filter & stock |
| `GET` | `/api/medicines/:id` | Public | Retrieve medicine details with active batch stock |
| `POST` | `/api/medicines` | Admin | Create medicine catalog item |
| `PUT` | `/api/medicines/:id` | Admin | Update medicine catalog item |
| `DELETE` | `/api/medicines/:id` | Admin | Delete medicine (returns 409 if referenced) |
| `GET` | `/api/batches` | Pharmacist, Admin | List inventory batches (optional `?medicineId=`) |
| `GET` | `/api/batches/expiring` | Pharmacist, Admin | Batches expiring within specified days (`?days=30`) |
| `POST` | `/api/batches` | Pharmacist, Admin | Add stock batch for a medicine |
| `PUT` | `/api/batches/:id` | Pharmacist, Admin | Update batch quantity or expiry date |
| `POST` | `/api/prescriptions` | Customer | Upload prescription image/PDF (multipart/form-data) |
| `GET` | `/api/prescriptions/my` | Customer | View customer's uploaded prescriptions |
| `GET` | `/api/prescriptions` | Pharmacist, Admin | View all prescriptions (optional `?status=`) |
| `PATCH` | `/api/prescriptions/:id/review` | Pharmacist, Admin | Approve or reject prescription; records `reviewed_by` |
| `POST` | `/api/orders` | Customer | Place order with transactional FEFO stock deduction |
| `GET` | `/api/orders/my` | Customer | View customer's order history with items and payments |
| `GET` | `/api/orders/:id` | Owner, Pharmacist, Admin | View specific order details |
| `GET` | `/api/orders` | Pharmacist, Admin | View all system orders (optional filter) |
| `PATCH` | `/api/orders/:id/status` | Pharmacist, Admin | Advance order status; restores stock if cancelled |
| `POST` | `/api/payments` | Customer | Pay for an order; marks status `paid` and sets `paid_at` |
| `GET` | `/api/payments/order/:orderId` | Owner, Pharmacist, Admin | View payment status and method for an order |
| `GET` | `/api/reports/sales` | Admin | Total revenue, order count, and payment breakdowns |
| `GET` | `/api/reports/low-stock` | Admin | Identify medicines below stock threshold (`?threshold=10`) |
| `GET` | `/api/reports/top-medicines` | Admin | Best-selling medicines by volume and revenue |

---

## 7. Business Rules Implementation

1. **Atomic Order Transaction:**
   Order placement executes in a single MySQL transaction (`connection.beginTransaction()`, `connection.commit()`, `connection.rollback()`). If any item stock is insufficient or validation fails, all changes are rolled back with no partial writes.
2. **Prescription Enforcement:**
   If any medicine in the order has `requires_prescription = true`, an approved `prescription_id` belonging to the customer must be provided. Unapproved or missing prescriptions return HTTP 403 Forbidden.
3. **FEFO Inventory Stock Deduction (First Expiry, First Out):**
   Batches are sorted by `expiry_date ASC`. Stock is consumed from the earliest expiring batch first, cascading into subsequent batches if needed. Row-level locks (`SELECT ... FOR UPDATE`) prevent race conditions under concurrent orders.
4. **Expired Batch Protection:**
   Batches where `expiry_date < CURDATE()` are strictly excluded from available inventory and order fulfillment. Orders requesting more than non-expired stock are rejected naming the medicine.
5. **Server-Calculated Pricing:**
   `unit_price` is retrieved directly from `medicines.price` at the time of purchase. Client-supplied price totals are completely ignored.
6. **Order Status Progression & Cancellation Stock Restoration:**
   Valid transitions: `pending` -> `confirmed` -> `shipped` -> `delivered`. Cancellations are permitted only from `pending` or `confirmed` status. When cancelled, inventory stock is automatically credited back to active batches.
7. **Idempotent Payment Settlement:**
   A payment cannot be marked `paid` more than once. Successful payment records capture `paid_at = CURRENT_TIMESTAMP`.
8. **Customer Ownership Privacy:**
   Customers are strictly scoped to their own records. They cannot view or manipulate prescriptions, orders, or payments belonging to other accounts.
9. **Referential Integrity Conflict Handling:**
   Attempting to delete a category or medicine that is referenced elsewhere in the system returns a clear HTTP 409 Conflict error with a descriptive message rather than a raw database error.

---

## 8. Relational Architecture of the 8 Entities

```
   [categories]
        | (1:N)
        v
   [medicines] <---------+
     |       | (1:N)     |
     | (1:N) v           | (1:N)
     |   [batches]       |
     |                   |
     v                   |
[order_items]            |
     ^ (1:N)             |
     |                   |
  [orders]               |
     | (1:1)             |
     v                   |
 [payments]              |
     ^                   |
     | (1:N)             |
  [users] ---------------+ (1:N reviews & uploads)
     |
     +-----> [prescriptions]
```

- `categories` to `medicines` (1:N): Categories categorize multiple medicines.
- `medicines` to `batches` (1:N): Medicines are divided into physical inventory lots with distinct expiry dates.
- `medicines` to `order_items` (1:N): Medicines appear across multiple order line items.
- `users` to `prescriptions` (1:N): Customers upload prescriptions; Pharmacists record reviews.
- `prescriptions` to `orders` (1:N): An approved prescription can authorize orders for prescription medications.
- `users` to `orders` (1:N): Customers place orders for medicines.
- `orders` to `order_items` (1:N): Orders consist of multiple line items.
- `orders` to `payments` (1:1): Every order is linked to exactly one payment record.

---

## 9. Deliverables & Documentation

- `docs/ERD.md`: Mermaid ER diagram and table schemas.
- `docs/postman_collection.json`: Complete Postman collection with dynamic token storage scripts.
- `database/schema.sql`: Full DDL script for the 8 tables.
- `database/seed.sql`: Realistic test data for all 8 tables.
- `scripts/initDb.js`: Database migration and verification utility (`npm run db:init`).
- `scripts/testSuite.js`: End-to-end integration test suite.

---

## 10. Role-Based AI Assistant Subsystem (Groq API)

PharmaCare includes an integrated, role-governed AI Subsystem powered by Groq's high-speed inference engine (`qwen/qwen3.8-27b`) with native function/tool calling.

### Architecture & Security Guarantees
- **Strict Database Boundary:** The AI subsystem **never touches or queries the database directly** (no SQL queries or direct pool connections).
- **Read-Only REST API Bridge:** All data access is mediated through internal HTTP `GET` requests (`aiApiDispatcher.js`) authenticated with the user's active JWT Bearer token.
- **Backend Middleware Enforcement:** Even if the LLM attempts to request unauthorized resources, Express middleware (`protect` and `restrictTo`) strictly rejects the request with HTTP 403 Forbidden.
- **Dynamic Role-Based Personas & Tool Filtering:**
  - **Customer Role:** Operates as a *Patient Health Assistant*. Answers medication queries, dosage guidance, OTC status, side effects, and tracks personal orders. Strictly prohibited from accessing warehouse batches, supplier costs, or sales revenue.
  - **Pharmacist Role:** Operates as a *Clinical & Inventory AI*. Inspects batch lots, identifies near-expiry stock (< 30 days) using FEFO, tracks low-stock lots (< 20 units), and monitors the fulfillment & prescription queue. Strictly barred from viewing sales revenue or financial analytics.
  - **Admin Role:** Operates as an *Executive Operations AI*. Has complete visibility across financial performance (total revenue, AOV, order volume), operational inventory health, top-selling medicines, and user accounts.
- **Frontend Widget:** A responsive, floating action button and chat window on the web portal with role-specific suggestion chips, streaming markdown rendering, and tool execution badges.

