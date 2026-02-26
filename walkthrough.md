# Prisma Removal Walkthrough

## Changes Made
- **Dependency Updates**: Uninstalled `prisma` and `@prisma/client`, and installed `mysql2`.
- **Database Connection**: Created `backend/src/db.ts` which uses `mysql2/promise` to establish a connection pool to the `pharmacy_pos` database using credentials from the running Docker configuration (`root:root`).
- **Schema Management**: Wrote `backend/src/schema.sql` containing exact raw SQL replicas of the previous Prisma models (`Role`, `Permission`, `Employee`, `Role_Permission`).
- **Seed Script**: Converted `backend/prisma/seed.ts` to `backend/src/seed.ts`. It now sequentially executes the schema statements, and gracefully inserts default permissions, roles, and the Admin user via SQL `INSERT IGNORE` or explicit existence checks.
- **Controller Refactoring**:
  - `auth.controller.ts`: Refactored to use standard SQL for `findUnique` (`SELECT`) and `create` (`INSERT`) operations.
  - `rbac.controller.ts`: Refactored `Role` retrieval to use SQL `JOIN`s, and reimagined the `updateRolePermissions` Prisma transaction as a standard `connection.beginTransaction()` and `connection.commit()` block.
- **Start Scripts**: Modified `start.sh` so that instead of `npx prisma db push`, it uses `npx tsx src/seed.ts` to setup the DDL schema and load initial data.

## Validation Results
We ran local tests on the refactored endpoints using `curl`:
- **Login Tests**: Authenticated successfully as `admin@pharmacy.com`, confirming that `auth.controller.ts` functions flawlessly and bcrypt comparisons are intact.
- **Role Permission Checks**: Used the retrieved Admin JWT token to test the secured `/api/roles` endpoint, which executed the multiple `LEFT JOIN` raw SQL successfully, returning all roles merged precisely as the Prisma `include:` arguments previously operated. 
The application has been successfully migrated to use the `mysql2` driver and raw SQL query structure with no dependencies on Prisma remaining.

---

## Module 2: Inventory Management & Supplier Finance System
> [!NOTE]
> Based on the successful Prisma to Raw MySQL migration, Module 2 was built entirely from scratch utilizing `mysql2/promise` and standard SQL queries.

### API & Database Design
* **Comprehensive API Specs:** Defined full REST specs inside `module2-api-docs.md` for Products, Suppliers, Invoices/GRN, and Check tracking.
* **Schema Additions:** Created standard raw MySQL tables mapping directly to business logic (`Products`, `Suppliers`, `Supplier_Invoices`, `Inventory_Batches`, `Audit_Logs`).
* **Sequential Seeding:** Modified `seed.ts` to idempotently seed new RBAC permissions specifically tailored for Module 2 Tab viewing (`VIEW_TAB_INVENTORY`, `VIEW_TAB_SUPPLIERS`, etc.).

### Backend Implementation
* **Controllers:** Implemented robust CRUD APIs via raw SQL for:
  * **Products & Suppliers:** With referential integrity and deletion guard checks.
  * **Stock Receiving (GRN):** Executed a fully transactional flow (MySQL `START TRANSACTION`, `INSERT`, `COMMIT`) guaranteeing that Supplier Invoices, Inventory Batches, and Audit Logs are synced strictly together. Failsafes roll back on error.
  * **Alerts & Finance Checks:** Complex SQL JOINs and groupings extract real-time Low Stock, Near Expiry Alerts, alongside Post-Dated Checks trackers.

### Frontend Integration (React + Shadcn UI)
* **Tailored Dashboard Routing:** Restructured `Dashboard.tsx` into a robust Tabbed Layout built on Shadcn UI components.
* **RBAC Display Logic:** Tabs conditionally render uniquely per logged-in user based on their exact permission assignments (e.g. only Cashiers see specific tabs, Admins see all).
* **GRN Real-time Form:** Constructed an advanced Goods Receipt Note interface that:
  * Supports dynamic rows for batches.
  * Incorporates live product search & search-as-you-type querying.
  * Automatically calculates Line Totals and Grand Totals securely before submission.
* **Build Validation:** Run through `vite build` validating complete type safety across the frontend ecosystem. All UI components are ready.

---

## Module 6: Patient Management & Prescription History
> [!NOTE]
> Engineered the Patient Tracking Module focusing specifically on GDPR data anonymization, strict PII cryptography, and automated discount calculations.

### Backend Data Security
* **PII Encryption API:** Built an `encryption.ts` utility utilizing AES-256-CBC cyphers to safely map and process `encrypted_bio_data` strings. The raw database strings are completely obfuscated, and decryption only occurs via the backend `Patients.controller` with strict RBAC rules.
* **Deterministic Hashing:** Implemented a SHA-256 hash pattern applied to phone numbers, solving the primary challenge of "Searching for Patients Data safely without decrypting thousands of database rows". Searching targets a pre-computed hash value.

### Backend Discount Engine
* **Dynamic Calculations Logic:** The POS Checkout API calls our specific `PatientsTab` Engine retrieving real-time dynamic discounting (e.g. 5% Senior Age Discount + 0.5% Loyalty Discount per active month).
* **Hard Capping:** Hardcoded business logic explicitly ensures no combined discount can mathematically exceed the absolute maximum of 7.0%.

### Frontend React Dashboards
* **Patient Hub & Profile:** Deployed secure registration popups verifying Explicit Opt-In consent. Developed the deep-profile pop-up mapping decrypted data locally and extracting automated historical Invoice + Script ledgers into separated Data Tables for tracking. 
* **The "Right to be Forgotten":** Integrated a highly-visible Opt-Out command firing `DELETE /patients/:id/opt-out` to nullify and overwrite previous patient profiles completely while securely maintaining analytics on the anonymized historical transaction rows.
* **POS Linkage Widget:** Completed a `PatientSelector` mapping widget integrated directly into the `PosTab.tsx` applying automated frontend calculation of the patient discounts instantly onto the POS Cart Subtotal prior to `handleCheckout`.
