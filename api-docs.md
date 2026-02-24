# Pharmacy POS - Role-Based Access Control (RBAC) API Documentation

## Authentication Endpoints

### 1. Register Employee
* **Endpoint:** `POST /api/auth/register`
* **Description:** Registers a new employee. Hashes the password using `bcrypt` and assigns default role if specified.
* **Authentication/Authorization:** Public (or restricted to Admin, depending on system policy. Assuming public for self-registration, or Admin-only in real scenario).
* **Request Payload (JSON):**
```json
{
  "name": "Jane Doe",
  "email": "jane@pharmacy.com",
  "password": "SecurePassword123!",
  "role_id": 3
}
```
* **Response Payload (Success - 201 Created):**
```json
{
  "message": "Employee registered successfully.",
  "employee": {
    "emp_id": 105,
    "name": "Jane Doe",
    "email": "jane@pharmacy.com",
    "role_id": 3
  }
}
```

### 2. Login Employee
* **Endpoint:** `POST /api/auth/login`
* **Description:** Authenticates an employee and returns a JWT containing their ID, role, and authorized action names (permissions).
* **Authentication/Authorization:** Public.
* **Request Payload (JSON):**
```json
{
  "email": "jane@pharmacy.com",
  "password": "SecurePassword123!"
}
```
* **Response Payload (Success - 200 OK):**
```json
{
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR...",
  "user": {
    "emp_id": 105,
    "name": "Jane Doe",
    "role": "Assistant Pharmacist",
    "permissions": ["VIEW_DASHBOARD", "CREATE_SALE"]
  }
}
```

---

## Role & Permission Management Endpoints

### 3. Fetch All Roles
* **Endpoint:** `GET /api/roles`
* **Description:** Retrieves all available roles along with their current permission mappings.
* **Authentication/Authorization:** Requires Bearer Token + `MANAGE_ROLES` permission.
* **Request Payload:** None.
* **Response Payload (Success - 200 OK):**
```json
{
  "roles": [
    {
      "role_id": 1,
      "role_name": "Admin",
      "description": "System Administrator",
      "permissions": [
        {"perm_id": 1, "action_name": "VIEW_DASHBOARD"},
        {"perm_id": 4, "action_name": "MANAGE_ROLES"}
      ]
    },
    {
      "role_id": 2,
      "role_name": "Cashier",
      "description": "Frontend point of sale user",
      "permissions": [
        {"perm_id": 1, "action_name": "VIEW_DASHBOARD"},
        {"perm_id": 2, "action_name": "CREATE_SALE"}
      ]
    }
  ]
}
```

### 4. Fetch All Permissions
* **Endpoint:** `GET /api/permissions`
* **Description:** Retrieves the master list of all available permissions in the system.
* **Authentication/Authorization:** Requires Bearer Token + `MANAGE_ROLES` permission.
* **Request Payload:** None.
* **Response Payload (Success - 200 OK):**
```json
{
  "permissions": [
    {"perm_id": 1, "action_name": "VIEW_DASHBOARD", "description": "Can access main dashboard"},
    {"perm_id": 2, "action_name": "CREATE_SALE", "description": "Can process a POS transaction"},
    {"perm_id": 3, "action_name": "VOID_SALE", "description": "Can cancel a POS transaction"},
    {"perm_id": 4, "action_name": "MANAGE_ROLES", "description": "Can modify user roles and permissions"}
  ]
}
```

### 5. Update Role Permissions (Mapping)
* **Endpoint:** `PUT /api/roles/:id/permissions`
* **Description:** Updates the permissions mapped to a specific role. Replaces the current mapping in `Role_Permissions` entirely.
* **Authentication/Authorization:** Requires Bearer Token + `MANAGE_ROLES` permission.
* **Request Payload (JSON):**
```json
{
  "permission_ids": [1, 2, 3]
}
```
* **Response Payload (Success - 200 OK):**
```json
{
  "message": "Role permissions updated successfully.",
  "role_id": 2,
  "updated_permissions": [1, 2, 3]
}
```
* **Response Payload (Failure - 403 Forbidden):**
```json
{
  "error": "Forbidden: Requires MANAGE_ROLES permission."
}
```
