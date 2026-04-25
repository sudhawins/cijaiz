-- Categories Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[categories]') AND type = 'U')
BEGIN
    CREATE TABLE categories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL UNIQUE,
        description NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
END;

-- Products Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND type = 'U')
BEGIN
    CREATE TABLE products (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        category_id INT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        weight_kg DECIMAL(10, 2) NOT NULL DEFAULT 0.50,
        stock INT DEFAULT 0,
        sku NVARCHAR(100) UNIQUE,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT fk_products_category FOREIGN KEY (category_id) 
            REFERENCES categories(id) ON DELETE CASCADE
    );
END;

-- Product Images Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[product_images]') AND type = 'U')
BEGIN
    CREATE TABLE product_images (
        id INT IDENTITY(1,1) PRIMARY KEY,
        product_id INT NOT NULL,
        image_url NVARCHAR(MAX) NOT NULL,
        filename NVARCHAR(255) NOT NULL,
        thumbnail_url NVARCHAR(MAX),
        uploaded_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) 
            REFERENCES products(id) ON DELETE CASCADE
    );
END;

-- Shopping Cart Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[cart_items]') AND type = 'U')
BEGIN
    CREATE TABLE cart_items (
        id INT IDENTITY(1,1) PRIMARY KEY,
        cart_session_id NVARCHAR(255) NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        added_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) 
            REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT uq_cart_items UNIQUE(cart_session_id, product_id)
    );
END;

-- Orders Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND type = 'U')
BEGIN
    CREATE TABLE orders (
        id INT IDENTITY(1,1) PRIMARY KEY,
        order_number NVARCHAR(100) NOT NULL UNIQUE,
        total_amount DECIMAL(10, 2) NOT NULL,
        status NVARCHAR(50) DEFAULT 'pending',
        customer_email NVARCHAR(255) NOT NULL,
        customer_name NVARCHAR(255) NOT NULL,
        shipping_address NVARCHAR(MAX),
        payment_method NVARCHAR(50) NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
END;

-- Order Items Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[order_items]') AND type = 'U')
BEGIN
    CREATE TABLE order_items (
        id INT IDENTITY(1,1) PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name NVARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) 
            REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) 
            REFERENCES products(id)
    );
END;

-- Search History Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[search_history]') AND type = 'U')
BEGIN
    CREATE TABLE search_history (
        id INT IDENTITY(1,1) PRIMARY KEY,
        session_id NVARCHAR(255) NOT NULL,
        search_query NVARCHAR(MAX) NOT NULL,
        results_count INT,
        searched_at DATETIME2 DEFAULT GETDATE()
    );
END;

-- Indexes (with IF NOT EXISTS pattern)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_products_category' AND object_id = OBJECT_ID('products'))
    CREATE INDEX idx_products_category ON products(category_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_products_name' AND object_id = OBJECT_ID('products'))
    CREATE INDEX idx_products_name ON products(name);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_products_sku' AND object_id = OBJECT_ID('products'))
    CREATE INDEX idx_products_sku ON products(sku);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_product_images_product' AND object_id = OBJECT_ID('product_images'))
    CREATE INDEX idx_product_images_product ON product_images(product_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_cart_items_session' AND object_id = OBJECT_ID('cart_items'))
    CREATE INDEX idx_cart_items_session ON cart_items(cart_session_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_cart_items_product' AND object_id = OBJECT_ID('cart_items'))
    CREATE INDEX idx_cart_items_product ON cart_items(product_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_orders_customer' AND object_id = OBJECT_ID('orders'))
    CREATE INDEX idx_orders_customer ON orders(customer_email);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_order_items_order' AND object_id = OBJECT_ID('order_items'))
    CREATE INDEX idx_order_items_order ON order_items(order_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_order_items_product' AND object_id = OBJECT_ID('order_items'))
    CREATE INDEX idx_order_items_product ON order_items(product_id);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_search_history_session' AND object_id = OBJECT_ID('search_history'))
    CREATE INDEX idx_search_history_session ON search_history(session_id);