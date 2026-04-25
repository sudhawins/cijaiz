-- Verification Script for Subcategories and Model Numbers
-- Run this script to verify the new columns and tables exist

-- Check if subcategories table exists
IF OBJECT_ID('[dbo].[subcategories]', 'U') IS NOT NULL
    PRINT 'Subcategories table EXISTS'
ELSE
    PRINT 'ERROR: Subcategories table MISSING'

-- Check if subcategory_id column exists in products
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'subcategory_id')
    PRINT 'Product subcategory_id column EXISTS'
ELSE
    PRINT 'ERROR: Product subcategory_id column MISSING'

-- Check if model_number column exists in products
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'model_number')
    PRINT 'Product model_number column EXISTS'
ELSE
    PRINT 'ERROR: Product model_number column MISSING'

-- Count records
SELECT 
    'Categories' as TableName,
    COUNT(*) as RecordCount 
FROM categories
UNION ALL
SELECT 
    'Subcategories',
    COUNT(*) 
FROM subcategories
UNION ALL
SELECT 
    'Products',
    COUNT(*) 
FROM products

-- Show products with new fields (sample)
SELECT TOP 5
    p.id,
    p.name,
    p.model_number,
    p.category_id,
    p.subcategory_id,
    c.name as category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
ORDER BY p.id DESC
