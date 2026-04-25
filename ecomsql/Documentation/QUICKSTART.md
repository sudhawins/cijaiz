# Quick Start Guide

## Prerequisites
- Node.js (v14+)
- SQL Server
- npm or yarn

## Setup Instructions

### 1. Database Setup

1. Open SQL Server Management Studio
2. Create a new database named `ecommerce`
3. Run the scripts in this order:
   ```
   Scripts/ecommerce.sql       (Create tables)
   Scripts/ecommerce_seed.sql  (Insert sample data)
   ```

### 2. Backend Setup

```bash
cd server
npm install
```

Edit `.env` file:
```
DB_SERVER=your-server-name
DB_NAME=ecommerce
DB_USER=your-username
DB_PASSWORD=your-password
```

Start the server:
```bash
npm start
```

Server will run on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd client
npm install
npm start
```

Frontend will open at `http://localhost:3000`

## Application Navigation

### Home (Products)
- View all available products
- Filter by category
- Search products
- Add items to cart

### Add Products
- Create new product categories
- Add new products with details

### Upload Images
- Upload product images
- Delete images
- Manage product images

### Cart
- View cart items
- Update quantities
- Proceed to checkout
- Create orders

### Orders
- View all orders
- Check order status
- View order details

## Key Features

✅ **Product Management** - Create, read, update, delete products
✅ **Image Upload** - Upload and manage product images
✅ **Shopping Cart** - Session-based cart with add/remove/update
✅ **Order Processing** - Place orders and track status
✅ **Category System** - Organize products into categories
✅ **Search & Filter** - Search products and filter by category

## API Base URL

All API requests use: `http://localhost:5000/api`

Example:
- GET `/api/products` - Get all products
- POST `/api/cart` - Add to cart
- POST `/api/orders` - Create order

## File Storage

- Uploaded images are stored in: `server/uploads/`
- Images accessible at: `http://localhost:5000/uploads/filename`
- Max file size: 5MB
- Supported formats: JPEG, PNG, GIF, WebP

## Testing the Application

1. Go to "Add Products" to create sample products
2. Go to "Upload Images" to add images to products  
3. Go to "Products" to browse and add to cart
4. Go to "Cart" to checkout
5. Go to "Orders" to view order history

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Cannot connect to database | Check SQL Server is running and credentials are correct |
| File upload fails | Ensure `server/uploads/` directory exists |
| CORS error | Make sure both backend and frontend are running |
| Images not loading | Check image URL in browser dev tools |

## Project Structure

```
server/
  ├── routes/           # API endpoints
  ├── middleware/       # Custom middleware (upload)
  ├── config.js         # Database config
  ├── server.js         # Main server
  └── uploads/          # Uploaded files

client/
  ├── src/
  │   ├── components/   # React components
  │   ├── api.js        # API client
  │   └── App.js        # Main app
  └── public/           # Static files
```

## Next Steps

1. Customize styling in CSS files
2. Add user authentication
3. Implement payment processing
4. Add product reviews
5. Create admin dashboard
6. Deploy to production

For more details, see [README.md](./README.md)
