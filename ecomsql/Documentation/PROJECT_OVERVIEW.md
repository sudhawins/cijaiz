# E-Commerce Full Stack Application

## 📁 Project Structure

This is a complete e-commerce platform with:
- **Backend**: Express.js server with SQL Server database
- **Frontend**: React SPA with responsive design
- **Database**: SQL Server with 7 tables (categories, products, images, cart, orders, etc.)

## 🚀 Quick Start

### 1. Database Setup
- Run `Scripts/ecommerce.sql` to create tables
- Run `Scripts/ecommerce_seed.sql` to add sample data

### 2. Start Backend
```bash
cd server
npm install
npm start
```
Server runs on `http://localhost:5000`

### 3. Start Frontend
```bash
cd client
npm install
npm start
```
Frontend runs on `http://localhost:3000`

## 📚 Documentation

- **[README.md](./README.md)** - Full project documentation
- **[QUICKSTART.md](./QUICKSTART.md)** - Setup and quick reference
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - API endpoints reference

## ✨ Features

✅ Product catalog with categories
✅ Image upload with file storage
✅ Shopping cart (session-based)
✅ Order management
✅ Search and filtering
✅ Responsive UI
✅ RESTful API

## 🛠 Tech Stack

**Backend:**
- Express.js
- SQL Server (MSSQL)
- Multer (file uploads)
- CORS

**Frontend:**
- React 18
- React Router
- Axios
- CSS3

## 📝 Environment Setup

Server `.env`:
```
PORT=5000
DB_SERVER=localhost
DB_NAME=ecommerce
DB_USER=sa
DB_PASSWORD=YourPassword123
```

## 🔗 API Base URL
`http://localhost:5000/api`

## 📱 Key Endpoints

- `GET /products` - List products
- `POST /products` - Create product
- `POST /product-images/upload/:productId` - Upload image
- `POST /cart` - Add to cart
- `POST /orders` - Create order

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

## 🎨 Components

### Frontend Components
- `ProductListing` - Browse products
- `ProductUpload` - Add products/categories
- `ImageUpload` - Manage product images
- `ShoppingCart` - Cart and checkout
- `OrderManagement` - View orders

### Backend Routes
- `/routes/categories.js` - Category management
- `/routes/products.js` - Product management  
- `/routes/productImages.js` - Image uploads
- `/routes/cart.js` - Shopping cart
- `/routes/orders.js` - Order processing

## 💾 Database Tables

1. **categories** - Product categories
2. **products** - Product information
3. **product_images** - Product images
4. **cart_items** - Shopping cart (session-based)
5. **orders** - Customer orders
6. **order_items** - Order line items
7. **search_history** - Search tracking

## 🚦 Getting Started

1. Clone or download this repository
2. Follow setup in QUICKSTART.md
3. Run database scripts
4. Start backend server
5. Start frontend application
6. Open http://localhost:3000

## 🔐 Production Checklist

- [ ] Add user authentication
- [ ] Implement HTTPS
- [ ] Add rate limiting
- [ ] Validate all inputs
- [ ] Add error logging
- [ ] Set up database backups
- [ ] Configure CORS properly
- [ ] Use environment variables
- [ ] Add payment processing
- [ ] Setup CI/CD pipeline

## 📞 Support

For help:
1. Check README.md for detailed documentation
2. Review API_DOCUMENTATION.md for API details
3. Check QUICKSTART.md for common issues

## 📄 License

MIT License
