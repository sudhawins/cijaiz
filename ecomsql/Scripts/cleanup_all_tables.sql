/*
  cleanup_all_tables.sql

  Purpose:
  - Drop foreign key constraints that involve project tables
  - Drop all known project tables if they exist

  Safety:
  - This script is destructive.
  - Review table list before running in any non-dev database.
*/

SET NOCOUNT ON;

DECLARE @TargetTables TABLE (TableName SYSNAME PRIMARY KEY);

INSERT INTO @TargetTables (TableName)
VALUES
    ('wishlist'),
    ('cart_items'),
    ('product_images'),
    ('order_items'),
    ('order_discounts'),
    ('reward_transactions'),
    ('customer_rewards'),
    ('search_history'),
    ('discounts'),
    ('orders'),
    ('products'),
    ('categories'),
    ('cities'),
    ('shipping_zones'),
    ('UserRole'),
    ('RoleDetail'),
    ('User'),
    ('CollectionReminder'),
    ('CollectionVerification'),
    ('Complains'),
    ('ComplaintStatus'),
    ('ComplainType'),
    ('ConsignmentImport'),
    ('ConsignmentMasters'),
    ('DailyRoomStatusMedia'),
    ('DailyRoomStatus'),
    ('EBServicePayments'),
    ('Occupancy'),
    ('RentalCollection'),
    ('RoomDetail'),
    ('ServiceConsumptionDetails'),
    ('ServiceRoomAllocation'),
    ('ServiceDetails'),
    ('StockDetails'),
    ('Tables'),
    ('Table'),
    ('Tenant'),
    ('Tenants'),
    ('Transactions'),
    ('TransactionType'),
    ('__MigrationHistory');

DECLARE @sql NVARCHAR(MAX) = N'';

;WITH fk_to_drop AS (
    SELECT
        fk.name AS fk_name,
        OBJECT_SCHEMA_NAME(fk.parent_object_id) AS parent_schema,
        OBJECT_NAME(fk.parent_object_id) AS parent_table
    FROM sys.foreign_keys fk
    WHERE
        OBJECT_NAME(fk.parent_object_id) IN (SELECT TableName FROM @TargetTables)
        OR OBJECT_NAME(fk.referenced_object_id) IN (SELECT TableName FROM @TargetTables)
)
SELECT @sql = @sql +
    N'ALTER TABLE [' + parent_schema + N'].[' + parent_table + N'] DROP CONSTRAINT [' + fk_name + N'];' + CHAR(10)
FROM fk_to_drop;

IF LEN(@sql) > 0
BEGIN
    PRINT 'Dropping foreign key constraints...';
    EXEC sp_executesql @sql;
END
ELSE
BEGIN
    PRINT 'No matching foreign keys found to drop.';
END;

SET @sql = N'';

SELECT @sql = @sql +
    N'IF OBJECT_ID(N''[dbo].[' + TableName + N']'', N''U'') IS NOT NULL DROP TABLE [dbo].[' + TableName + N'];' + CHAR(10)
FROM @TargetTables;

PRINT 'Dropping tables...';
EXEC sp_executesql @sql;

PRINT 'Cleanup complete.';
