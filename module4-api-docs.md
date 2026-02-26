# Module 4: Customer Service & LLM Assistant
**Isolated Microservice Documentation**

## Overview
This module operates completely isolated from the main Pharmacy POS architecture. It runs on its own infrastructure:
*   **Backend:** Port 4000 (Express/Node.js)
*   **Frontend:** Port 5174 (React/Vite)
*   **Database:** Conceptually mapped to a separate external connection (e.g., `pharmacy_customer_db`).

It facilitates direct customer interactions via a mocked LLM chat interface, capable of logging conversations, securely storing appointments, and providing Pharmacists a portal to intervene or review chats.

---

## Database Schema (Concept)
The backend employs `mysql2/promise` to interact with a standalone database structure.

*   `Customers`: Extracted metadata for the querying user (`id`, `anonymized`, `created_at`).
*   `Chat_Sessions`: Ties a conversation flow to a customer (`id`, `customer_id`, `status: [Active, Resolved]`, `started_at`).
*   `Chat_Messages`: The individual messages within a session (`id`, `session_id`, `sender: [Customer, LLM, Pharmacist]`, `content`, `internal_note`, `timestamp`).
*   `Pharmacist_Schedules`: Tracks available windows (`id`, `pharmacist_name`, `date`, `shift_start`, `shift_end`).
*   `Appointments`: User-booked meetings (`id`, `customer_id`, `pharmacist_id`, `scheduled_time`, `symptoms_note`, `status`).

---

## Frontend Integration Map
*   **Customer Facing (`/`):** Clean light-theme UI. Chatbot strictly enforces "No Diagnostic Data", includes an Appointment form pushing to the backend, and hosts a single-click Opt-Out payload.
*   **Pharmacist Dashboard (`/admin`):** Split-view Dashboard for managing Appointments and taking over in-progress Chat Sessions.

---

## API Endpoints

### 1. Send Chat Message
**Endpoint:** `POST /api/chat/send`
**Description:** Appends a customer's message to an active chat session. Generates an automated LLM reply ("I cannot diagnose..."). It inherently mocks an internal check to the main POS backend (`GET http://localhost:3000/api/inventory/safe-check`) if the query mentions medicine availability.

**Request Payload (JSON):**
```json
{
  "customer_id": 1,
  "session_id": "uuid-string",
  "content": "Do you have any Paracetamol available for my headache today?"
}
```

**Response Payload (JSON):**
```json
{
  "message_id": 1024,
  "timestamp": "2026-02-26T18:00:00.000Z",
  "llm_reply": "I cannot diagnose or recommend treatments for a headache. Please book a consultation with our pharmacist. However, checking our inventory... Yes, Paracetamol is currently in stock.",
  "status": "Message Sent",
  "rate_limit_remaining": 49
}
```

### 2. Book Consultation Appointment
**Endpoint:** `POST /api/appointments/book`
**Description:** Persists a scheduled time requested from the frontend `datetime-local` input into MySQL format `YYYY-MM-DD HH:MM:SS`.

**Request Payload (JSON):**
```json
{
  "customer_id": 1,
  "pharmacist_id": 2,
  "scheduled_time": "2026-02-27T10:30",
  "symptoms_note": "Persistent migraine for two days"
}
```

**Response Payload (JSON):**
```json
{
  "appointment_id": 45,
  "status": "Confirmed",
  "scheduled_for": "2026-02-27 10:30:00"
}
```

### 3. Opt-Out (Anonymize Data)
**Endpoint:** `DELETE /api/customers/:id/opt-out`
**Description:** Scrambles or purges identifiable tokens matching the `customer_id` across the isolated database.

**Response Payload (JSON):**
```json
{
  "status": "Success",
  "message": "Customer data has been permanently anonymized per privacy request."
}
```

### 4. Admin: View Active Chat Sessions
**Endpoint:** `GET /api/admin/chat-sessions`
**Description:** Retrieves a list of active and resolved sessions for the Pharmacist dash.

**Response Payload (JSON):**
```json
[
  {
    "session_id": "uuid-string",
    "customer_id": 1,
    "status": "Active",
    "message_count": 12,
    "started_at": "2026-02-26T17:45:00.000Z"
  }
]
```

### 5. Admin: Fetch Chat Messages
**Endpoint:** `GET /api/admin/chat-sessions/:id/messages`
**Description:** Pulls the chronological log of messages within a selected session.

**Response Payload (JSON):**
```json
[
  {
    "message_id": 1023,
    "sender": "Customer",
    "content": "Do you have any Paracetamol available?",
    "internal_note": null,
    "timestamp": "2026-02-26T18:00:00.000Z"
  },
  {
    "message_id": 1024,
    "sender": "LLM",
    "content": "I cannot diagnose... Yes, Paracetamol is in stock.",
    "internal_note": "Passed checking thresholds.",
    "timestamp": "2026-02-26T18:00:05.000Z"
  }
]
```

### 6. Admin: Reply to Customer Chat
**Endpoint:** `POST /api/admin/chat-sessions/:id/reply`
**Description:** Interjects a Pharmacist-authored note directly into the live log.

**Request Payload (JSON):**
```json
{
  "pharmacist_id": 2,
  "content": "Hello, I am Pharmacist John. I can prepare that Paracetamol for pick-up."
}
```

**Response Payload (JSON):**
```json
{
  "message_id": 1025,
  "status": "Delivered"
}
```

### 7. Admin: Resolve Chat Session
**Endpoint:** `PATCH /api/chat/sessions/:id/resolve`
**Description:** Closes the chat and appends a final internal triage summary.

**Request Payload (JSON):**
```json
{
  "internal_note": "Resolved. Customer scheduled a pickup."
}
```

**Response Payload (JSON):**
```json
{
  "session_id": "uuid-string",
  "status": "Resolved",
  "message": "Session concluded successfully."
}
```

### 8. Admin: View Appointments
**Endpoint:** `GET /api/admin/appointments`
**Description:** Fetches grid data for incoming meetings.

**Response Payload (JSON):**
```json
[
  {
    "appointment_id": 45,
    "customer_id": 1,
    "pharmacist_id": 2,
    "scheduled_time": "2026-02-27 10:30:00",
    "symptoms_note": "Persistent migraine for two days",
    "status": "Confirmed"
  }
]
```
