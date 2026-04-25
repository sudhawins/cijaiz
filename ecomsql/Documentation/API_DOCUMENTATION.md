# API Documentation

## Base URL
`http://localhost:5000/api`

## Authentication
Currently no authentication required. Future versions should implement JWT or session-based auth.

## Response Format
All responses are JSON format.

### Success Response
```json
{
  "id": 1,
  "data": {}
}
```

### Error Response
```json
{
  "error": "Error message describing what went wrong"
}
```

---

## Categories API

### Get All Categories
```
GET /categories
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Electronics",
    "description": "Electronic devices and gadgets",
    "created_at": "2026-02-28T10:00:00",
    "updated_at": "2026-02-28T10:00:00"
  }
]
```

### Get Category by ID
```
GET /categories/:id
```

**Parameters:**
- `id` (integer): Category ID

### Create Category
```
POST /categories
Content-Type: application/json

{
  "name": "Books",
  "description": "Books and reading materials"
}
```

**Required Fields:**
- `name` (string): Category name

**Optional Fields:**
- `description` (string): Category description

### Update Category
```
PUT /categories/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

### Delete Category
```
DELETE /categories/:id
```

---

## Products API

### Get All Products
```
GET /products
```

**Query Parameters:**
- `categoryId` (integer): Filter by category
- `search` (string): Search in name and description

**Example:**
```
GET /products?categoryId=1&search=wireless
```

### Get Product by ID
```
GET /products/:id
```

**Response includes related images:**
```json
{
  "id": 1,
  "name": "Wireless Headphones",
  "description": "...",
  "category_id": 1,
  "category_name": "Electronics",
  "price": 99.99,
  "stock": 50,
  "sku": "WH-001",
  "created_at": "2026-02-28T10:00:00",
  "updated_at": "2026-02-28T10:00:00",
  "images": [
    {
      "id": 1,
      "product_id": 1,
      "image_url": "/uploads/product-123456.jpg",
      "filename": "product-123456.jpg",
      "thumbnail_url": null,
      "uploaded_at": "2026-02-28T10:00:00"
    }
  ]
}
```

### Create Product
```
POST /products
Content-Type: application/json

{
  "name": "Product Name",
  "description": "Product description",
  "category_id": 1,
  "price": 99.99,
  "stock": 50,
  "sku": "SKU-001"
}
```

**Required Fields:**
- `name` (string)
- `category_id` (integer)
- `price` (decimal)

**Optional Fields:**
- `description` (string)
- `stock` (integer, default: 0)
- `sku` (string)

### Update Product
```
PUT /products/:id
Content-Type: application/json
```

### Delete Product
```
DELETE /products/:id
```

---

## Product Images API

### Get Product Images
```
GET /product-images/product/:productId
```

### Upload Product Image
```
POST /product-images/upload/:productId
Content-Type: multipart/form-data

Form Data:
- image (file): Image file to upload
```

**Supported Formats:** JPEG, PNG, GIF, WebP
**Max Size:** 5MB

**Response:**
```json
{
  "id": 1,
  "product_id": 1,
  "image_url": "/uploads/product-1234567890.jpg",
  "filename": "product-1234567890.jpg",
  "thumbnail_url": null,
  "uploaded_at": "2026-02-28T10:00:00"
}
```

### Delete Product Image
```
DELETE /product-images/:imageId
```

---

## Shopping Cart API

### Get Cart Items
```
GET /cart/:sessionId
```

**Parameters:**
- `sessionId` (string): Session identifier

**Response:**
```json
[
  {
    "id": 1,
    "cart_session_id": "session-123",
    "product_id": 1,
    "product_name": "Wireless Headphones",
    "price": 99.99,
    "quantity": 2,
    "stock": 50,
    "added_at": "2026-02-28T10:00:00"
  }
]
```

### Add to Cart
```
POST /cart
Content-Type: application/json

{
  "sessionId": "session-123",
  "productId": 1,
  "quantity": 1
}
```

**Note:** If item already exists, quantity is incremented.

### Update Cart Item
```
PUT /cart/:itemId
Content-Type: application/json

{
  "quantity": 5
}
```

### Remove from Cart
```
DELETE /cart/:itemId
```

### Clear Cart
```
DELETE /cart/session/:sessionId
```

---

## Orders API

### Get All Orders
```
GET /orders
```

### Get Order by ID
```
GET /orders/:id
```

**Response includes order items:**
```json
{
  "id": 1,
  "order_number": "ORD-1704067200000-ABC123xyz",
  "total_amount": 199.98,
  "status": "pending",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "shipping_address": "123 Main St, City, State 12345",
  "created_at": "2026-02-28T10:00:00",
  "updated_at": "2026-02-28T10:00:00",
  "items": [
    {
      "id": 1,
      "order_id": 1,
      "product_id": 1,
      "product_name": "Wireless Headphones",
      "quantity": 2,
      "unit_price": 99.99
    }
  ]
}
```

### Create Order
```
POST /orders
Content-Type: application/json

{
  "sessionId": "session-123",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "shippingAddress": "123 Main St, City, State 12345",
  "items": [
    {
      "productId": 1,
      "productName": "Wireless Headphones",
      "quantity": 2,
      "price": 99.99
    }
  ],
  "totalAmount": 199.98
}
```

**Required Fields:**
- `customerName` (string)
- `customerEmail` (string)
- `items` (array with productId, quantity, price)
- `totalAmount` (decimal)

**Optional Fields:**
- `shippingAddress` (string)

**Note:** After order creation, cart is automatically cleared.

### Update Order Status
```
PUT /orders/:id
Content-Type: application/json

{
  "status": "shipped"
}
```

**Valid Statuses:**
- `pending`
- `processing`
- `shipped`
- `delivered`
- `cancelled`

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid input |
| 404 | Not Found - Resource not found |
| 500 | Server Error - Internal server error |

---

## Rate Limiting

Currently no rate limiting is implemented. Add in production.

---

## CORS Policy

The API accepts requests from `http://localhost:3000` by default. Update CORS settings for production.

---

## Pagination

Currently not implemented. Consider adding for large datasets.

---

## Webhooks

Not currently implemented.

---

## Versioning

API version: v1 (no version prefix in URLs currently)
