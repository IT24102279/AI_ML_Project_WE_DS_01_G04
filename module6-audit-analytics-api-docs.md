# Module 6: Internal Analytics & Audit Logging API Documentation

## 1. Get Audit Logs
**Endpoint:** `GET /api/admin/audit-logs`
**Description:** Fetches paginated system-wide action logs from the `Audit_Logs` table, joined with the `Employee` table to retrieve employee names. Supports advanced filtering.
**Required Permission:** `VIEW_DASHBOARD` (or equivalent admin permission)

**Request Query Parameters:**
* `emp_id` (optional): Filter logs by a specific employee ID.
* `action_type` (optional): Filter by exact action type (e.g., `CREATE_SALE`, `DELETE_USER`).
* `start_date` (optional): ISO date string to filter logs after this date.
* `end_date` (optional): ISO date string to filter logs before this date.
* `page` (optional, default 1): Pagination page number.
* `limit` (optional, default 50): Number of records per page.

**Response Payload (JSON):**
```json
{
  "total": 1500,
  "page": 1,
  "limit": 50,
  "data": [
    {
      "log_id": 450,
      "emp_id": 3,
      "employee_name": "Jane Doe",
      "action_type": "CREATE_SALE",
      "details": "Sale INVOICE-1002 completed for 450.00 LKR",
      "timestamp": "2026-03-04T14:30:00.000Z"
    }
  ]
}
```

## 1.1. Delete Audit Log
**Endpoint:** `DELETE /api/admin/audit-logs/:id`
**Description:** Deletes a specific audit log entry.
**Required Permission:** `MANAGE_AUDIT` (or high-level admin permission)

**Response Payload (JSON):**
```json
{
  "status": "Success",
  "message": "Audit log deleted successfully."
}
```

## 1.2. Export Audit Logs
**Endpoint:** `GET /api/admin/audit-logs/export`
**Description:** Exports the audit logs as a CSV file for compliance and external reporting.
**Required Permission:** `VIEW_DASHBOARD`

**Response:**
Returns a `text/csv` file containing the filtered logs.

## 2. Get Financial Analytics
**Endpoint:** `GET /api/admin/financial-analytics`
**Description:** Executes raw SQL aggregation queries to calculate the true financial health of the pharmacy over a given date range. Computes Gross Revenue, Cost of Goods Sold (COGS), Operating Expenses, Payroll, and Net Profit. Also returns a 30-day time-series data array for charting.
**Required Permission:** `VIEW_TAB_FINANCE`

**Request Query Parameters:**
* `start_date` (optional): Start of the date range (default: 30 days ago).
* `end_date` (optional): End of the date range (default: today).

**Response Payload (JSON):**
```json
{
  "summary": {
    "gross_revenue": 150000.00,
    "cogs": 60000.00,
    "operating_expenses": 20000.00,
    "payroll": 30000.00,
    "net_profit": 40000.00
  },
  "time_series": [
    {
      "date": "2026-02-04",
      "revenue": 5000.00,
      "expenses": 3500.00
    },
    {
      "date": "2026-02-05",
      "revenue": 5500.00,
      "expenses": 3600.00
    }
  ]
}
```

## 2.1. Add Operating Expense
**Endpoint:** `POST /api/admin/financial-analytics/expenses`
**Description:** Manually log a new operating expense (e.g., rent, utilities).
**Required Permission:** `MANAGE_FINANCE`

**Request Payload (JSON):**
```json
{
  "amount": 2500.00,
  "category": "Utilities",
  "description": "Electricity Bill for Feb",
  "recorded_date": "2026-02-28"
}
```

**Response Payload (JSON):**
```json
{
  "expense_id": 101,
  "status": "Created"
}
```

## 2.2. Delete Operating Expense
**Endpoint:** `DELETE /api/admin/financial-analytics/expenses/:id`
**Description:** Removes a logged operating expense.
**Required Permission:** `MANAGE_FINANCE`

**Response Payload (JSON):**
```json
{
  "status": "Deleted"
}
```

## 2.3. Update Employee Salary Details
**Endpoint:** `PUT /api/admin/employees/:id/salary`
**Description:** Update the base salary, hourly wage, or standard deductions for an employee. Changes here will be used to calculate future payroll runs.
**Required Permission:** `MANAGE_PAYROLL`

**Request Payload (JSON):**
```json
{
  "base_salary": 60000.00,
  "hourly_rate": null,
  "standard_deductions": 2000.00
}
```

**Response Payload (JSON):**
```json
{
  "status": "Updated",
  "message": "Employee salary details updated"
}
```

## 2.4. Add Payroll Entry (Run Payroll)
**Endpoint:** `POST /api/admin/financial-analytics/payroll`
**Description:** Log a specific payroll transaction (a paycheck) for an employee.
**Required Permission:** `MANAGE_PAYROLL`

**Request Payload (JSON):**
```json
{
  "emp_id": 3,
  "gross_pay": 5000.00,
  "deductions": 500.00,
  "net_salary": 4500.00,
  "pay_period_start": "2026-02-01",
  "pay_period_end": "2026-02-28",
  "payment_date": "2026-03-01"
}
```

**Response Payload (JSON):**
```json
{
  "payroll_id": 42,
  "status": "Created"
}
```

## 2.5. Update Payroll Entry
**Endpoint:** `PUT /api/admin/financial-analytics/payroll/:id`
**Description:** Edit an existing payroll entry if a mistake was made during the run.
**Required Permission:** `MANAGE_PAYROLL`

**Request Payload (JSON):**
```json
{
  "gross_pay": 5500.00,
  "deductions": 500.00,
  "net_salary": 5000.00
}
```

**Response Payload (JSON):**
```json
{
  "status": "Updated"
}
```

## 2.6. Delete Payroll Entry
**Endpoint:** `DELETE /api/admin/financial-analytics/payroll/:id`
**Description:** Removes a logged payroll entry.
**Required Permission:** `MANAGE_PAYROLL`

**Response Payload (JSON):**
```json
{
  "status": "Deleted"
}
```
