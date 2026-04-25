# Backend API Reference

## Overview

Base URL: `/api`

Content type:
- JSON for standard requests and responses
- `multipart/form-data` for file upload endpoints

Authentication:
- JWT bearer token header: `Authorization: Bearer <token>`
- Admin-only endpoints require a valid token and the `admin` role

Common response pattern:
- `200 OK` or `201 Created` for success
- `400 Bad Request` for validation or malformed input
- `401 Unauthorized` for missing or invalid token
- `403 Forbidden` for authenticated users without sufficient role
- `404 Not Found` for missing records or files
- `500 Internal Server Error` for unexpected server failures

## Upload Endpoints

| Endpoint | Method | Multipart Fields | Notes |
| --- | --- | --- | --- |
| `/tenants/upload` | `POST` | `photos`, `proofs` | Up to 10 files per field, images only |
| `/complaints/upload` | `POST` | `proof1`, `proof2`, `video` | Complaint media upload |
| `/daily-status/upload` | `POST` | `files` | Up to 4 images or videos |
| `/daily-status/{dailyStatusId}/guest-checkins/{guestCheckinId}/upload` | `POST` | `proof`, `photo` | Guest proof and photo |
| `/rental/upload-payment` | `POST` | `screenshot` | Payment proof image |

## Authentication

### `POST /auth/login`
Authenticate a user and issue access and refresh tokens.

Request body:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

Typical response:
```json
{
  "token": "<jwt>",
  "refreshToken": "<refresh-token>",
  "user": {
    "id": 1,
    "username": "admin",
    "roles": "admin"
  }
}
```

### `POST /auth/refresh`
Issue a new access token from a valid refresh token.

Request body:
```json
{
  "refreshToken": "<refresh-token>"
}
```

## Health And Diagnostics

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Service health check |
| `GET` | `/database/status` | No | Database connectivity status |
| `GET` | `/tables` | No | List database tables |
| `GET` | `/diagnostic/rental-schema` | No | Inspect rental collection schema |
| `GET` | `/diagnostic/rental-sample` | No | Sample rental collection rows |
| `GET` | `/complaints/test-upload` | No | Verify complaint upload storage |
| `POST` | `/debug/test-blob-delete` | No | Azure blob delete test endpoint |

## Rooms

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/rooms` | No | List rooms with room details |
| `GET` | `/rooms/occupancy` | No | List rooms with current occupancy data |
| `GET` | `/rooms/vacant` | No | List vacant rooms |
| `PUT` | `/rooms/{id}` | No | Update room details |

Path parameters:
- `id`: Room identifier

## Occupancy

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/occupancy/links` | Admin | Inspect active tenant-room links |
| `POST` | `/occupancy/checkin` | No | Create a new occupancy/check-in |
| `POST` | `/occupancy/{occupancyId}/checkout` | No | Check out an active occupancy |

Common fields:
- `tenantId`
- `roomId`
- `checkInDate`
- `checkOutDate`

Path parameters:
- `occupancyId`: Occupancy identifier

## Tenants

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/tenants/with-occupancy` | No | List tenants with occupancy history/current occupancy |
| `GET` | `/tenants/{id}` | No | Get a tenant with related details |
| `GET` | `/tenants/{id}/occupancy-history` | No | Get occupancy history for a tenant |
| `GET` | `/tenants/check-phone/{phone}` | No | Check whether a phone number already exists |
| `GET` | `/tenants/search` | No | Search tenants by name or phone |
| `POST` | `/tenants` | No | Create a tenant, optionally with occupancy |
| `POST` | `/tenants/upload` | No | Upload tenant photos and proof files |
| `PUT` | `/tenants/{id}` | No | Update a tenant |
| `DELETE` | `/tenants/{id}` | No | Delete a tenant |

Query parameters:
- `/tenants/check-phone/{phone}`: `excludeId`
- `/tenants/search`: `name`, `phone`

Typical create fields:
```json
{
  "name": "John Doe",
  "phone": "9876543210",
  "address": "Sample address",
  "city": "Chennai",
  "roomId": 12,
  "checkInDate": "2026-04-01",
  "photoUrl": "tenant-photo.jpg",
  "proof1Url": "aadhaar-front.jpg"
}
```

## Rental Collection And Payments

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/rental/summary` | No | Monthly rental collection summary |
| `GET` | `/rental/unpaid-tenants` | No | Occupancies with pending rent |
| `GET` | `/rental/unpaid-details/{month}` | No | Unpaid rent details for a month |
| `GET` | `/rental/payments/{monthYear}` | No | Payment records for a month |
| `GET` | `/rental/occupancy/{occupancyId}` | No | Rental history for an occupancy |
| `GET` | `/rental/occupancy/{occupancyId}/summary` | No | Payment and pro-rata summary for an occupancy |
| `GET` | `/rental/payment-balance` | No | Payment totals versus outstanding balances |
| `POST` | `/rental/upload-payment` | No | Record a payment with screenshot |

Path parameters:
- `month`: `YYYY-MM`
- `monthYear`: `YYYY-MM`
- `occupancyId`: Occupancy identifier

Multipart fields for `/rental/upload-payment`:
- `screenshot`

Typical form fields for `/rental/upload-payment`:
- `occupancyId`
- `rentReceived`
- `modeOfPayment`
- `rentReceivedOn`

## Complaints

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/complaints` | No | List complaints with optional filters |
| `GET` | `/complaints/types` | No | Complaint type lookup |
| `GET` | `/complaints/statuses` | No | Complaint status lookup |
| `POST` | `/complaints` | No | Create a complaint |
| `PUT` | `/complaints/{id}` | No | Update a complaint |
| `DELETE` | `/complaints/{id}` | No | Delete a complaint |
| `GET` | `/complains/{fileName}` | No | Fetch uploaded complaint file |
| `POST` | `/complaints/upload` | No | Upload complaint proofs or video |

Query parameters for `/complaints`:
- `occupancyId`
- `status`
- `type`

Multipart fields for `/complaints/upload`:
- `proof1`
- `proof2`
- `video`

Typical create fields:
```json
{
  "occupancyId": 25,
  "complaintType": "plumbing",
  "description": "Water leakage in bathroom",
  "status": "Open",
  "proof1Url": "proof1.jpg",
  "proof2Url": "proof2.jpg",
  "videoUrl": "issue.mp4"
}
```

## Daily Status And Guest Check-ins

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/daily-status` | No | List daily status records |
| `GET` | `/daily-status/{id}` | No | Get one daily status record |
| `POST` | `/daily-status` | No | Create a daily status record |
| `PUT` | `/daily-status/{id}` | No | Update a daily status record |
| `DELETE` | `/daily-status/{id}` | No | Delete a daily status record |
| `GET` | `/daily-status/{id}/guest-checkins` | No | List guest check-ins for a daily status |
| `POST` | `/daily-status/{id}/guest-checkins` | No | Add a guest check-in |
| `PUT` | `/daily-status/{dailyStatusId}/guest-checkins/{guestCheckinId}` | No | Update a guest check-in |
| `POST` | `/daily-status/{dailyStatusId}/guest-checkins/{guestCheckinId}/upload` | No | Upload guest proof and photo |
| `DELETE` | `/daily-status/{dailyStatusId}/guest-checkins/{guestCheckinId}` | No | Delete a guest check-in |
| `GET` | `/daily-status/{id}/media` | No | List media for a daily status |
| `GET` | `/all-media/` | No | List media across all daily statuses |
| `POST` | `/daily-status/upload` | No | Upload daily status media |
| `DELETE` | `/daily-status/media/{id}` | No | Delete a media item |
| `GET` | `/guest-checkin/{fileName}` | No | Fetch uploaded guest check-in file |

Common fields:
- Daily status: `occupancyId`, `statusDate`, `notes`
- Guest check-in: `guestName`, `relationship`, `idProof`

Multipart fields:
- `/daily-status/upload`: `files`
- `/daily-status/{dailyStatusId}/guest-checkins/{guestCheckinId}/upload`: `proof`, `photo`

## Services

### Service Definitions

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/services/details` | Admin | List service definitions |
| `GET` | `/services/details/{id}` | Admin | Get one service definition |
| `POST` | `/services/details` | Admin | Create a service definition |
| `PUT` | `/services/details/{id}` | Admin | Update a service definition |
| `DELETE` | `/services/details/{id}` | Admin | Delete a service definition |

Typical fields:
- `serviceName`
- `unitType`
- `unitCost`

### Service Payments

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/services/payments` | No | List service payment records |
| `GET` | `/services/payments/{id}` | No | Get one service payment |
| `POST` | `/services/payments` | No | Create a service payment |
| `PUT` | `/services/payments/{id}` | No | Update a service payment |
| `DELETE` | `/services/payments/{id}` | No | Delete a service payment |

Typical fields:
- `occupancyId`
- `serviceId`
- `amount`

## Service Allocation And Consumption

### Service Allocations

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/service-allocations` | Admin | List service allocations |
| `GET` | `/service-allocations/{id}` | Admin | Get one service allocation |
| `POST` | `/service-allocations` | Admin | Create a service allocation |
| `PUT` | `/service-allocations/{id}` | Admin | Update a service allocation |
| `DELETE` | `/service-allocations/{id}` | Admin | Delete a service allocation |
| `GET` | `/service-allocations-with-payments` | Admin | List allocations joined with payments |
| `GET` | `/service-allocations-for-reading` | Admin | List allocations prepared for meter entry |

### Service Consumption

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/service-consumption` | No | List service consumption records |
| `GET` | `/service-consumption/{id}` | No | Get one service consumption record |
| `GET` | `/service-consumption/previous-month-reading/{serviceAllocId}/{month}/{year}` | No | Fetch previous month reading |
| `POST` | `/service-consumption` | No | Record a meter reading |
| `DELETE` | `/service-consumption/{id}` | No | Delete a meter reading |

Typical fields:
- `serviceAllocId`
- `currentReading`
- `readingDate`

## Billing And Pro-Rata Charges

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/tenant-service-charges/calculate/{serviceConsumptionId}` | No | Calculate charge from a consumption record |
| `GET` | `/tenant-service-charges/{billingYear}/{billingMonth}` | No | List tenant charges for a month |
| `GET` | `/room-billing-summary/{billingYear}/{billingMonth}` | No | Room-level billing summary |
| `GET` | `/monthly-billing-report/{billingYear}/{billingMonth}` | No | Full monthly billing report |
| `GET` | `/eb-room-monthly-report/{billingYear}/{billingMonth}` | No | Electricity billing report by room |
| `GET` | `/tenant-monthly-bill/{tenantId}` | No | Tenant monthly bill summary |
| `POST` | `/tenant-service-charges/recalculate/{billingYear}/{billingMonth}` | No | Recalculate all charges for a month |
| `GET` | `/tenant-service-charges` | No | List all tenant service charges |
| `PUT` | `/tenant-service-charges/{id}/status` | No | Update charge payment status |

Path parameters:
- `serviceConsumptionId`
- `billingYear`
- `billingMonth`
- `tenantId`
- `id`

## Users, Roles, And Access Control

### Users

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/users` | Admin | List users |
| `GET` | `/users/{id}` | Admin | Get one user |
| `POST` | `/users` | Admin | Create a user |
| `PUT` | `/users/{id}` | Admin | Update a user |
| `DELETE` | `/users/{id}` | Admin | Delete a user |

### Roles

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/roles` | Admin | List roles |
| `GET` | `/roles/{id}` | Admin | Get one role |
| `POST` | `/roles` | Admin | Create a role |
| `PUT` | `/roles/{id}` | Admin | Update a role |
| `DELETE` | `/roles/{id}` | Admin | Delete a role |

### User Roles

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/user-roles` | No | List user-role assignments |
| `POST` | `/user-roles` | No | Assign a role to a user |
| `DELETE` | `/user-roles/{id}` | No | Remove a role assignment |

Typical fields:
- Users: `username`, `password`, `name`
- Roles: `roleName`, `roleType`
- User roles: `userId`, `roleId`

## Transactions And Stock

### Transactions

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/transactions` | No | List transactions |
| `GET` | `/transactions/{id}` | No | Get one transaction |
| `POST` | `/transactions` | No | Create a transaction |
| `PUT` | `/transactions/{id}` | No | Update a transaction |
| `DELETE` | `/transactions/{id}` | No | Delete a transaction |
| `GET` | `/transaction-types` | No | List transaction type lookup values |

### Stock

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/stock` | No | List stock items |
| `GET` | `/stock/{id}` | No | Get one stock item |
| `POST` | `/stock` | No | Create a stock item |
| `PUT` | `/stock/{id}` | No | Update a stock item |
| `DELETE` | `/stock/{id}` | No | Delete a stock item |

Typical fields:
- Transactions: `transactionType`, `amount`, `date`
- Stock: `itemName`, `quantity`, `price`

## Search And Lookup

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/cities/search` | No | Search cities for autocomplete |

Query parameters:
- `q`: Search term

## Notes

- Most routes are public; only selected administrative routes enforce JWT and admin-role checks.
- File-serving routes resolve files from local storage first and Azure Blob Storage as a fallback when configured.
- This reference is based on the routes currently implemented in [backend/src/index.ts](../backend/src/index.ts).