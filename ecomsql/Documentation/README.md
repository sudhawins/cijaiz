# E-Commerce Full-Stack Application

A modern full-stack e-commerce application built with React (frontend) and Express (backend) connected to SQL Server database.

## Features

- **Product Management**: Create, read, update, and delete products
- **Category Management**: Organize products into categories
- **Image Upload**: Upload and manage product images with file storage
- **Shopping Cart**: Add products to cart with session management
- **Order Management**: Place orders and track order status
- **Responsive Design**: Mobile-friendly UI built with React

## Project Structure

```
ecomsql/
├── Scripts/                    # Database schema files
│   ├── ecommerce.sql          # Database schema
│   └── ecommerce_seed.sql     # Sample data
├── server/                     # Express backend
│   ├── config.js              # Database configuration
│   ├── server.js              # Main server file
│   ├── package.json           # Server dependencies
│   ├── .env                   # Environment variables
│   ├── middleware/
│   │   └── upload.js          # File upload middleware
│   ├── routes/
│   │   ├── categories.js      # Category endpoints
│   │   ├── products.js        # Product endpoints
│   │   ├── productImages.js   # Image upload endpoints
│   │   ├── cart.js            # Shopping cart endpoints
│   │   └── orders.js          # Order endpoints
│   └── uploads/               # Uploaded images directory
└── client/                     # React frontend
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js             # Main app component
    │   ├── App.css
    │   ├── api.js             # API client
    │   ├── index.js
    │   └── components/
    │       ├── ProductListing.js
    │       ├── ProductUpload.js
    │       ├── ImageUpload.js
    │       ├── ShoppingCart.js
    │       └── OrderManagement.js
    └── package.json
```


## Quick Start with Docker

For the fastest setup, use Docker and Docker Compose:

```bash
# 1. Copy and configure environment variables
cp .env.example .env
# Edit .env with your database credentials

# 2. Start all services
docker-compose up
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

**⚠️ Having issues?** See troubleshooting guides:
- [DEBUGGING.md](DEBUGGING.md) - Database and product loading issues
- [ENV_SETUP.md](ENV_SETUP.md) - Environment variable configuration
- [DOCKER_TROUBLESHOOTING.md](DOCKER_TROUBLESHOOTING.md) - Docker build and runtime errors
- [NPM_TROUBLESHOOTING.md](NPM_TROUBLESHOOTING.md) - NPM install and dependency issues
- [DOCKERFILE_GUIDE.md](DOCKERFILE_GUIDE.md) - Choosing between Dockerfiles

For detailed Docker instructions, see [DOCKER.md](DOCKER.md).

## Backend Setup

### Prerequisites
- Node.js (v14 or higher)
- SQL Server (2012 or higher)

### Installation

1. **Install dependencies**:
```bash
cd server
npm install
```

2. **Configure database**:
   - Edit `.env` file with your SQL Server connection details:
   ```
   DB_SERVER=localhost
   DB_NAME=ecommerce
   DB_USER=sa
   DB_PASSWORD=YourPassword123
   DB_ENCRYPT=false
   DB_TRUST_SERVER_CERTIFICATE=true
   ```

3. **Create database and seed data**:
   
   **On Windows:**
   ```bash
   # Set environment variables first (in PowerShell):
   $env:DB_SERVER = "your-server.database.windows.net"
   $env:DB_NAME = "your-database"
   $env:DB_USER = "your-username"
   $env:DB_PASSWORD = "your-password"
   
   # Then run the setup script:
   .\db-setup.bat init
   ```
   
   **On Linux/Mac:**
   ```bash
   export DB_SERVER="your-server.database.windows.net"
   export DB_NAME="your-database"
   export DB_USER="your-username"
   export DB_PASSWORD="your-password"
   
   chmod +x db-setup.sh
   ./db-setup.sh init
   ```
   
   **Or manually in SQL Server Management Studio:**
   ```sql
   -- First run ecommerce.sql to create tables
   -- Then run ecommerce_seed.sql to add sample data
   ```

4. **Start the server**:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

The server will run on `http://localhost:5000`

## Frontend Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Install dependencies**:
```bash
cd client
npm install
```

2. **Start the development server**:
```bash
npm start
```

The application will open at `http://localhost:3000`

## API Endpoints

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Products
- `GET /api/products` - Get all products (with filters)
- `GET /api/products/:id` - Get product by ID with images
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Product Images
- `GET /api/product-images/product/:productId` - Get images for product
- `POST /api/product-images/upload/:productId` - Upload product image
- `DELETE /api/product-images/:imageId` - Delete image

### Shopping Cart
- `GET /api/cart/:sessionId` - Get cart items
- `POST /api/cart` - Add item to cart
- `PUT /api/cart/:itemId` - Update cart item quantity
- `DELETE /api/cart/:itemId` - Remove item from cart
- `DELETE /api/cart/session/:sessionId` - Clear entire cart

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get order by ID with items
- `POST /api/orders` - Create order from cart
- `PUT /api/orders/:id` - Update order status

## Features

### Product Management
- Browse all products with filtering by category
- Search products
- View product details and images
- Add products to cart

### Admin Features
- Add new products
- Manage categories
- Upload product images
- Manage orders and track status

### Shopping
- Add items to shopping cart
- Update quantities
- Remove items
- Checkout with customer information
- Track order history

## Technologies Used

### Backend
- **Express.js** - REST API framework
- **MSSQL** - SQL Server database driver
- **Multer** - File upload middleware
- **CORS** - Cross-origin resource sharing
- **Express Validator** - Input validation

### Frontend
- **React** - UI library
- **React Router DOM** - Client-side routing
- **Axios** - HTTP client
- **CSS3** - Styling

## Database Schema

### Tables
1. **categories** - Product categories
2. **products** - Product information
3. **product_images** - Product images (supports multiple per product)
4. **cart_items** - Shopping cart items (session-based)
5. **orders** - Customer orders
6. **order_items** - Items in each order
7. **search_history** - Search query tracking

## File Upload

- **Location**: `server/uploads/` directory
- **Supported Formats**: JPEG, PNG, GIF, WebP
- **Max File Size**: 5MB
- **Images are accessible at**: `http://localhost:5000/uploads/filename`

## Environment Variables

### Server (.env)
```
PORT=5000
DB_SERVER=localhost
DB_NAME=ecommerce
DB_USER=sa
DB_PASSWORD=YourPassword123
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

## Running the Full Application

### Terminal 1 - Start Backend
```bash
cd server
npm start
```

### Terminal 2 - Start Frontend
```bash
cd client
npm start
```

Both should be running for the full application to work:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Troubleshooting

### No Products or Orders Showing
If the frontend shows "No products found" or no orders:

1. **Check database connection:**
   ```bash
   curl http://localhost:5000/api/debug
   ```
   This will show database status and record counts.

2. **Verify database has data:**
   - If tables are empty, run the seed script:
   ```bash
   # Windows:
   .\db-setup.bat init
   
   # Linux/Mac:
   ./db-setup.sh init
   ```

3. **Check server logs for errors:**
   Look for `[DEBUG]` and `[ERROR]` messages in the server console.

For detailed debugging, see [DEBUGGING.md](DEBUGGING.md).

### Database Connection Error
- Verify SQL Server is running
- Check credentials in `.env` file
- Ensure database `ecommerce` exists
- Check SQL Server authentication is enabled
- Test connection with debug endpoint: `curl http://localhost:5000/api/debug`

### File Upload Error
- Ensure `server/uploads/` directory exists
- Check file permissions on uploads folder
- Verify file size is under 5MB
- Check file format is supported (JPEG, PNG, GIF, WebP)

### Database Not Initialized
If you see "Invalid object name" errors:
1. Run the database setup script:
   - Windows: `.\db-setup.bat init`
   - Linux/Mac: `./db-setup.sh init`
2. Or manually run the SQL scripts in your database client

### CORS Error
- Verify server is running on port 5000
- Check proxy setting in `client/package.json`
- Clear browser cache and cookies

## Future Enhancements

- User authentication and authorization
- Payment integration
- Email notifications
- Product reviews and ratings
- Wishlists
- Inventory management
- Admin dashboard
- Analytics and reporting

## License

MIT

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.
