BEGIN TRANSACTION;

BEGIN TRY
    -- Insert sample categories
    IF NOT EXISTS (SELECT 1 FROM categories WHERE name = N'Electronics')
        INSERT INTO categories (name, description) VALUES (N'Electronics', N'Electronic devices and gadgets');

    IF NOT EXISTS (SELECT 1 FROM categories WHERE name = N'Clothing')
        INSERT INTO categories (name, description) VALUES (N'Clothing', N'Apparel and fashion items');

    IF NOT EXISTS (SELECT 1 FROM categories WHERE name = N'Home & Garden')
        INSERT INTO categories (name, description) VALUES (N'Home & Garden', N'Home and garden products');

    IF NOT EXISTS (SELECT 1 FROM categories WHERE name = N'Sports & Outdoors')
        INSERT INTO categories (name, description) VALUES (N'Sports & Outdoors', N'Sports equipment and outdoor gear');

    IF NOT EXISTS (SELECT 1 FROM categories WHERE name = N'Books')
        INSERT INTO categories (name, description) VALUES (N'Books', N'Books and reading materials');


    -- Insert sample products
    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = N'WH-001')
        INSERT INTO products (name, description, category_id, price, stock, sku)
        VALUES (N'Wireless Headphones', N'High-quality wireless headphones with noise cancellation', 1, 99.99, 50, N'WH-001');

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = N'UC-001')
        INSERT INTO products (name, description, category_id, price, stock, sku)
        VALUES (N'USB-C Cable', N'Durable USB-C charging cable, 2 meters', 1, 12.99, 200, N'UC-001');

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = N'CT-001')
        INSERT INTO products (name, description, category_id, price, stock, sku)
        VALUES (N'Cotton T-Shirt', N'Comfortable cotton t-shirt for everyday wear', 2, 19.99, 100, N'CT-001');

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = N'DJ-001')
        INSERT INTO products (name, description, category_id, price, stock, sku)
        VALUES (N'Denim Jeans', N'Classic blue denim jeans with perfect fit', 2, 49.99, 75, N'DJ-001');

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = N'LD-001')
        INSERT INTO products (name, description, category_id, price, stock, sku)
        VALUES (N'LED Desk Lamp', N'Adjustable LED desk lamp with USB charging', 3, 34.99, 40, N'LD-001');

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = N'YM-001')
        INSERT INTO products (name, description, category_id, price, stock, sku)
        VALUES (N'Yoga Mat', N'Non-slip yoga mat for fitness and exercise', 4, 29.99, 60, N'YM-001');

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = N'RS-001')
        INSERT INTO products (name, description, category_id, price, stock, sku)
        VALUES (N'Running Shoes', N'Professional running shoes for athletes', 4, 79.99, 35, N'RS-001');

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = N'BK-001')
        INSERT INTO products (name, description, category_id, price, stock, sku)
        VALUES (N'React Guide', N'Complete guide to learning React development', 5, 39.99, 25, N'BK-001');

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = N'BK-002')
        INSERT INTO products (name, description, category_id, price, stock, sku)
        VALUES (N'JavaScript Patterns', N'Design patterns in JavaScript explained', 5, 44.99, 30, N'BK-002');

    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = N'PC-001')
        INSERT INTO products (name, description, category_id, price, stock, sku)
        VALUES (N'Phone Case', N'Protective phone case for smartphones', 1, 14.99, 150, N'PC-001');


    -- Insert sample cart items (optional, can be empty initially)
    -- Example with IF NOT EXISTS:
    -- IF NOT EXISTS (SELECT 1 FROM cart_items WHERE cart_session_id = N'session-123' AND product_id = 1)
    --     INSERT INTO cart_items (cart_session_id, product_id, quantity) VALUES (N'session-123', 1, 2);

    -- IF NOT EXISTS (SELECT 1 FROM cart_items WHERE cart_session_id = N'session-123' AND product_id = 3)
    --     INSERT INTO cart_items (cart_session_id, product_id, quantity) VALUES (N'session-123', 3, 1);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;

    -- Optional: log error
    PRINT 'Error inserting sample data: ' + ERROR_MESSAGE();
END CATCH;