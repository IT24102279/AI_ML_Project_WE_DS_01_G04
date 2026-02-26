# Module 6: Patient Management API Documentation

## 1. Create Patient
**Endpoint:** `POST /api/patients`  
**Description:** Registers a new patient. Encrypts PII (bio data, clinical notes). Registration MUST include explicit consent.  
**Required Permission:** `MANAGE_PATIENTS` or `POS_ACCESS`

**Request Payload:**
```json
{
  "name": "John Doe",
  "phone": "555-1234",
  "address": "123 Main St",
  "birth_year": 1950,
  "clinical_notes": "Allergic to Penicillin",
  "consent_given": true
}
```

**Response Payload:**
```json
{
  "message": "Patient registered successfully",
  "patient_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

## 2. Get Patient Profile
**Endpoint:** `GET /api/patients/:id`  
**Description:** Fetches and decrypts a patient's bio data, and aggregates their `Sales_Invoices` and `Prescriptions` history.  
**Required Permission:** `MANAGE_PATIENTS` or `POS_ACCESS`

**Response Payload:**
```json
{
  "patient_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "John Doe",
  "phone": "555-1234",
  "address": "123 Main St",
  "birth_year": 1950,
  "clinical_notes": "Allergic to Penicillin",
  "opted_out": false,
  "created_at": "2023-01-01T10:00:00Z",
  "history": {
    "invoices": [
      {
        "invoice_id": 123,
        "total_amount": 50.00,
        "payment_method": "Cash",
        "created_at": "2023-05-01T12:00:00Z"
      }
    ],
    "prescriptions": [
      {
        "prescription_id": 456,
        "status": "Verified",
        "created_at": "2023-05-01T11:30:00Z"
      }
    ]
  }
}
```

---

## 3. Search Patients by Phone
**Endpoint:** `GET /api/patients/search?phone=...`  
**Description:** Hashes the incoming phone number and queries the `phone_number_hash` index to quickly find a patient without decrypting the whole table.  
**Required Permission:** `MANAGE_PATIENTS` or `POS_ACCESS`

**Response Payload:**
```json
[
  {
    "patient_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "John Doe",
    "phone": "555-1234",
    "birth_year": 1950
  }
]
```

---

## 4. Calculate Patient Discount
**Endpoint:** `GET /api/patients/:id/discount`  
**Description:** Applies loyalty and senior logic to calculate a combined discount, dynamically capped at 7%.  
**Required Permission:** `POS_ACCESS`

**Response Payload:**
```json
{
  "patient_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "senior_pct": 5,
  "loyalty_pct": 2,
  "applied_discount_pct": 7
}
```

---

## 5. Opt-Out Patient Data
**Endpoint:** `DELETE /api/patients/:id/opt-out`  
**Description:** Performs a "Soft/Hard" hybrid delete. Clears encrypted data (`encrypted_bio_data`, `encrypted_clinical_notes`) and the `phone_number_hash` to permanently anonymize the data.  
**Required Permission:** `MANAGE_PATIENTS`

**Response Payload:**
```json
{
  "message": "Patient data has been successfully anonymized."
}
```
