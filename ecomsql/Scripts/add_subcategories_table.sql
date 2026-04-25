-- Add Subcategories Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[subcategories]') AND type = 'U')
BEGIN
    CREATE TABLE subcategories (
        id INT IDENTITY(1,1) PRIMARY KEY,
        category_id INT NOT NULL,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT fk_subcategories_category FOREIGN KEY (category_id) 
            REFERENCES categories(id) ON DELETE CASCADE,
        CONSTRAINT uq_subcategory_name_per_category UNIQUE(category_id, name)
    );
    
    CREATE INDEX idx_subcategories_category_id ON subcategories(category_id);
    
    PRINT 'Subcategories table created successfully';
END;
ELSE
BEGIN
    PRINT 'Subcategories table already exists';
END;
