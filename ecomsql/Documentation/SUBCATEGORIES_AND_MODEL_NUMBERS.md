# Subcategories and Model Numbers Implementation

## Overview
This implementation adds two new features to the e-commerce system:
1. **Subcategories** - A hierarchical category structure where each subcategory belongs to a parent category
2. **Model Numbers** - Product model identifiers for better inventory management

## Database Changes

### New Table: `subcategories`
- `id` (INT PRIMARY KEY IDENTITY)
- `category_id` (INT FOREIGN KEY to categories)
- `name` (NVARCHAR(255), NOT NULL, UNIQUE per category)
- `description` (NVARCHAR(MAX), nullable)
- `created_at` (DATETIME2, default GETDATE())
- `updated_at` (DATETIME2, default GETDATE())

**Constraints:**
- Foreign key: `fk_subcategories_category` → categories(id) ON DELETE CASCADE
- Unique constraint: `uq_subcategory_name_per_category` on (category_id, name)
- Index: `idx_subcategories_category_id` on category_id

### Products Table Updates
Added two new columns:
- `subcategory_id` (INT, nullable) - Foreign key to subcategories table
- `model_number` (NVARCHAR(100), nullable) - Product model identifier

**Foreign Key:**
- `fk_products_subcategory` → subcategories(id) ON DELETE SET NULL

**Indexes:**
- `idx_products_subcategory_id` on subcategory_id
- `idx_products_model_number` on model_number

## Migration Scripts

Run these SQL scripts in order to update your database:

1. **add_subcategories_table.sql** - Creates the subcategories table
2. **add_model_number_to_products.sql** - Adds model_number column to products
3. **add_subcategory_to_products.sql** - Adds subcategory_id column and foreign key to products

Verify the changes with: **verify_subcategories_and_model_numbers.sql**

## API Endpoints

### Subcategories Management

#### GET /api/subcategories
Get all subcategories (optionally filtered by category)

**Query Parameters:**
- `categoryId` (optional, INT) - Filter by parent category ID

**Example:**
```javascript
GET /api/subcategories
GET /api/subcategories?categoryId=1
```

**Response:**
```json
[
  {
    "id": 1,
    "category_id": 1,
    "name": "Electronics",
    "description": "Electronic devices and accessories",
    "created_at": "2026-04-25T10:30:00.000Z",
    "updated_at": "2026-04-25T10:30:00.000Z"
  }
]
```

#### GET /api/subcategories/:id
Get a specific subcategory by ID

**Example:**
```javascript
GET /api/subcategories/1
```

#### GET /api/subcategories/category/:categoryId
Get all subcategories for a specific category

**Example:**
```javascript
GET /api/subcategories/category/1
```

#### POST /api/subcategories
Create a new subcategory (Seller/Administrator only)

**Required Fields:**
- `category_id` (INT) - Parent category ID
- `name` (STRING) - Subcategory name

**Optional Fields:**
- `description` (STRING) - Subcategory description

**Example Request:**
```javascript
POST /api/subcategories
Content-Type: application/json
Authorization: Bearer <token>

{
  "category_id": 1,
  "name": "Smartphones",
  "description": "Mobile phones and accessories"
}
```

**Response:**
```json
{
  "id": 5,
  "category_id": 1,
  "name": "Smartphones",
  "description": "Mobile phones and accessories",
  "created_at": "2026-04-25T10:30:00.000Z",
  "updated_at": "2026-04-25T10:30:00.000Z"
}
```

#### PUT /api/subcategories/:id
Update a subcategory (Seller/Administrator only)

**Fields:**
- `name` (STRING) - New name
- `description` (STRING) - New description

**Example Request:**
```javascript
PUT /api/subcategories/5
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Mobile Phones",
  "description": "Smartphones and feature phones"
}
```

#### DELETE /api/subcategories/:id
Delete a subcategory (Administrator only)

**Example:**
```javascript
DELETE /api/subcategories/5
Authorization: Bearer <token>
```

### Products with Model Numbers

#### GET /api/products
Get all products - now includes `model_number` and `subcategory_id`

**Response includes:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "iPhone 15 Pro",
      "model_number": "A3097",
      "category_id": 1,
      "subcategory_id": 5,
      "price": 999.99,
      "stock": 50,
      "sku": "IPHONE-15-PRO",
      "weight_kg": 0.201,
      "category_name": "Electronics",
      "image_url": "...",
      ...
    }
  ]
}
```

#### POST /api/products
Create a new product (Seller/Administrator only) - now accepts `model_number` and `subcategory_id`

**Fields:**
- `name` (STRING, REQUIRED)
- `category_id` (INT, REQUIRED)
- `price` (DECIMAL, REQUIRED)
- `sku` (STRING, REQUIRED)
- `description` (STRING)
- `subcategory_id` (INT, optional) - ID of parent subcategory
- `model_number` (STRING, optional) - Product model number
- `stock` (INT, optional, default 0)
- `weight_kg` (DECIMAL, optional, default 0.5)
- `is_preorder` (BOOLEAN, optional)
- `preorder_release_date` (DATE, optional)

**Example Request:**
```javascript
POST /api/products
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "iPhone 15 Pro Max",
  "description": "Latest flagship iPhone",
  "category_id": 1,
  "subcategory_id": 5,
  "price": 1099.99,
  "stock": 100,
  "sku": "IPHONE-15-PM",
  "weight_kg": 0.221,
  "model_number": "A3100",
  "is_preorder": false
}
```

#### PUT /api/products/:id
Update a product - now supports `model_number` and `subcategory_id` updates

**Example Request:**
```javascript
PUT /api/products/1
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "iPhone 15 Pro Max",
  "model_number": "A3100",
  "subcategory_id": 5,
  "price": 1099.99,
  "stock": 95
}
```

## Usage Examples

### JavaScript/Node.js

```javascript
// Get all subcategories
const subcategories = await fetch('/api/subcategories').then(r => r.json());

// Get subcategories for a specific category
const categorySubcategories = await fetch('/api/subcategories?categoryId=1').then(r => r.json());

// Create a new subcategory
const newSubcategory = await fetch('/api/subcategories', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    category_id: 1,
    name: 'Laptops',
    description: 'Computers and laptops'
  })
}).then(r => r.json());

// Create a product with model number and subcategory
const newProduct = await fetch('/api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    name: 'Dell XPS 15',
    category_id: 1,
    subcategory_id: 10,
    price: 1299.99,
    sku: 'DELL-XPS-15',
    model_number: 'XPS-9530',
    stock: 20,
    weight_kg: 2.0
  })
}).then(r => r.json());
```

## Frontend Integration

When displaying products, you can now show:
- Product name
- Model number
- Category name
- Subcategory name (if applicable)

When creating/editing products, include fields for:
- Category selection (dropdown)
- Subcategory selection (dynamically populated based on category)
- Model number input

## Notes

- Subcategory names must be unique within each category (but can be the same across different categories)
- When a product is deleted, its images are automatically deleted (CASCADE)
- When a subcategory is deleted, products in that subcategory will have `subcategory_id` set to NULL (SET NULL)
- Model numbers can be searched using the existing search endpoint
- All timestamps (created_at, updated_at) are in UTC format (DATETIME2)
