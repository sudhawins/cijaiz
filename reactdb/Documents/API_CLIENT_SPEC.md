# Client-Facing API Spec

## Purpose

This document is the short-form client integration guide for the backend API in this repository. It is meant for frontend or API consumers who need the main workflows, expected authentication behavior, and the most important request formats without reading every route.

Base URL:
- `http://localhost:5000/api`

Authentication:
- Header: `Authorization: Bearer <token>`
- Access token lifetime: 24 hours
- Refresh token lifetime: 30 days
- Only selected administrative endpoints require a bearer token and `admin` role

## Core Workflows

### 1. Login

Endpoint:
- `POST /auth/login`

Request:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response:
```json
{
  "token": "<jwt>",
  "refreshToken": "<refresh-token>",
  "user": {
    "id": 1,
    "username": "admin",
    "name": "Administrator",
    "roles": "admin"
  }
}
```

Refresh token:
- `POST /auth/refresh`

Request:
```json
{
  "refreshToken": "<refresh-token>"
}
```

### 2. Tenant Onboarding

Recommended flow:
1. Upload tenant files with `POST /tenants/upload`
2. Create the tenant with `POST /tenants`
3. If a room is being assigned immediately, include occupancy fields in the tenant or occupancy payload according to the screen flow

Upload fields:
- `photos`: up to 10 image files
- `proofs`: up to 10 image files

Create tenant example:
```json
{
  "name": "John Doe",
  "phone": "9876543210",
  "address": "12 Main Street",
  "city": "Chennai",
  "roomId": 14,
  "checkInDate": "2026-04-10",
  "photoUrl": "photos-1712800012345.jpg",
  "proof1Url": "proofs-1712800012399.jpg"
}
```

Useful tenant endpoints:
- `GET /tenants/with-occupancy`
- `GET /tenants/{id}`
- `GET /tenants/{id}/occupancy-history`
- `GET /tenants/check-phone/{phone}?excludeId={tenantId}`
- `GET /tenants/search?name=...` or `GET /tenants/search?phone=...`
- `PUT /tenants/{id}`
- `DELETE /tenants/{id}`

### 3. Room Occupancy

Read occupancy state:
- `GET /rooms/occupancy`
- `GET /rooms/vacant`

Check in:
- `POST /occupancy/checkin`

Example:
```json
{
  "tenantId": 23,
  "roomId": 14,
  "checkInDate": "2026-04-10"
}
```

Check out:
- `POST /occupancy/{occupancyId}/checkout`

Example:
```json
{
  "checkOutDate": "2026-04-30"
}
```

Admin-only occupancy inspection:
- `GET /occupancy/links`

### 4. Rental Collection

Use these endpoints for rental dashboards and payment flows:
- `GET /rental/summary`
- `GET /rental/unpaid-tenants`
- `GET /rental/unpaid-details/{month}` where month is `YYYY-MM`
- `GET /rental/payments/{monthYear}` where monthYear is `YYYY-MM`
- `GET /rental/occupancy/{occupancyId}`
- `GET /rental/occupancy/{occupancyId}/summary`
- `GET /rental/payment-balance`

Payment upload:
- `POST /rental/upload-payment`

Multipart fields:
- `screenshot`: image file

Form fields:
- `occupancyId`
- `rentReceived`
- `modeOfPayment`
- `rentReceivedOn`

### 5. Complaints

List and manage complaints:
- `GET /complaints`
- `GET /complaints/types`
- `GET /complaints/statuses`
- `POST /complaints`
- `PUT /complaints/{id}`
- `DELETE /complaints/{id}`

Optional query filters for `GET /complaints`:
- `occupancyId`
- `status`
- `type`

Complaint upload:
- `POST /complaints/upload`

Multipart fields:
- `proof1`
- `proof2`
- `video`

Create complaint example:
```json
{
  "occupancyId": 14,
  "complaintType": "Electrical",
  "description": "Switchboard issue in room",
  "status": "Open",
  "proof1Url": "proof1-1712801010101.jpg",
  "proof2Url": "proof2-1712801010102.jpg",
  "videoUrl": "video-1712801010103.mp4"
}
```

File retrieval:
- `GET /complains/{fileName}`

### 6. Daily Status And Guest Check-ins

Daily status endpoints:
- `GET /daily-status`
- `GET /daily-status/{id}`
- `POST /daily-status`
- `PUT /daily-status/{id}`
- `DELETE /daily-status/{id}`

Daily status create example:
```json
{
  "occupancyId": 14,
  "statusDate": "2026-04-11",
  "notes": "Guest expected in evening"
}
```

Guest check-in endpoints:
- `GET /daily-status/{id}/guest-checkins`
- `POST /daily-status/{id}/guest-checkins`
- `PUT /daily-status/{dailyStatusId}/guest-checkins/{guestCheckinId}`
- `DELETE /daily-status/{dailyStatusId}/guest-checkins/{guestCheckinId}`

Guest check-in example:
```json
{
  "guestName": "Arun",
  "relationship": "Friend",
  "idProof": "Driving License"
}
```

Guest check-in file upload:
- `POST /daily-status/{dailyStatusId}/guest-checkins/{guestCheckinId}/upload`

Multipart fields:
- `proof`
- `photo`

Daily status media:
- `GET /daily-status/{id}/media`
- `GET /all-media/`
- `POST /daily-status/upload`
- `DELETE /daily-status/media/{id}`

Upload fields for `POST /daily-status/upload`:
- `files`: up to 4 images or videos
- `dailyStatusId`
- `mediaType`

Guest file retrieval:
- `GET /guest-checkin/{fileName}`

### 7. Services And Utility Billing

Admin-only service definitions:
- `GET /services/details`
- `GET /services/details/{id}`
- `POST /services/details`
- `PUT /services/details/{id}`
- `DELETE /services/details/{id}`

Service payments:
- `GET /services/payments`
- `GET /services/payments/{id}`
- `POST /services/payments`
- `PUT /services/payments/{id}`
- `DELETE /services/payments/{id}`

Service allocations, admin-only:
- `GET /service-allocations`
- `GET /service-allocations/{id}`
- `POST /service-allocations`
- `PUT /service-allocations/{id}`
- `DELETE /service-allocations/{id}`
- `GET /service-allocations-with-payments`
- `GET /service-allocations-for-reading`

Service consumption:
- `GET /service-consumption`
- `GET /service-consumption/{id}`
- `POST /service-consumption`
- `DELETE /service-consumption/{id}`
- `GET /service-consumption/previous-month-reading/{serviceAllocId}/{month}/{year}`

### 8. Billing Reports

Key monthly billing endpoints:
- `POST /tenant-service-charges/calculate/{serviceConsumptionId}`
- `GET /tenant-service-charges/{billingYear}/{billingMonth}`
- `GET /room-billing-summary/{billingYear}/{billingMonth}`
- `GET /monthly-billing-report/{billingYear}/{billingMonth}`
- `GET /eb-room-monthly-report/{billingYear}/{billingMonth}`
- `GET /tenant-monthly-bill/{tenantId}`
- `POST /tenant-service-charges/recalculate/{billingYear}/{billingMonth}`
- `GET /tenant-service-charges`
- `PUT /tenant-service-charges/{id}/status`

### 9. Admin Management

Users, admin-only:
- `GET /users`
- `GET /users/{id}`
- `POST /users`
- `PUT /users/{id}`
- `DELETE /users/{id}`

Roles, admin-only:
- `GET /roles`
- `GET /roles/{id}`
- `POST /roles`
- `PUT /roles/{id}`
- `DELETE /roles/{id}`

User-role assignments:
- `GET /user-roles`
- `POST /user-roles`
- `DELETE /user-roles/{id}`

### 10. Transactions, Stock, And Lookup

Transactions:
- `GET /transactions`
- `GET /transactions/{id}`
- `POST /transactions`
- `PUT /transactions/{id}`
- `DELETE /transactions/{id}`
- `GET /transaction-types`

Stock:
- `GET /stock`
- `GET /stock/{id}`
- `POST /stock`
- `PUT /stock/{id}`
- `DELETE /stock/{id}`

Lookup:
- `GET /cities/search?q=chen`

## Error Model

Most failures return JSON with at least:

```json
{
  "error": "Human-readable message"
}
```

Some handlers also include:

```json
{
  "error": "Human-readable message",
  "details": "Additional server detail"
}
```

## Notes

- Many list endpoints return raw SQL-backed objects rather than a tightly normalized API schema.
- File-serving routes use local storage first and Azure Blob Storage as a fallback when configured.
- The most complete route inventory remains in [Documents/API_REFERENCE.md](./API_REFERENCE.md).
- The machine-readable version of this document is [Documents/openapi.yaml](./openapi.yaml).