/*
  cleanup_data_reseed.sql

  Purpose:
  - Remove all data from known project tables
  - Keep schema (tables, columns, indexes, constraints)
  - Reseed identity columns to 0 so next insert starts at 1

  Safety:
  - This script is destructive for data, but non-destructive for schema.
  - Intended for development/test environments.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

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

BEGIN TRY
    BEGIN TRAN;

    /* Temporarily disable constraints to avoid FK ordering issues during delete. */
    SELECT @sql = @sql +
        N'ALTER TABLE [dbo].' + QUOTENAME(t.TableName) + N' NOCHECK CONSTRAINT ALL;' + CHAR(10)
    FROM @TargetTables t
    WHERE OBJECT_ID(N'[dbo].' + QUOTENAME(t.TableName), N'U') IS NOT NULL;

    IF LEN(@sql) > 0
        EXEC sp_executesql @sql;

    SET @sql = N'';

    /* Delete table data while preserving schema. */
    SELECT @sql = @sql +
        N'DELETE FROM [dbo].' + QUOTENAME(t.TableName) + N';' + CHAR(10)
    FROM @TargetTables t
    WHERE OBJECT_ID(N'[dbo].' + QUOTENAME(t.TableName), N'U') IS NOT NULL;

    IF LEN(@sql) > 0
        EXEC sp_executesql @sql;

    SET @sql = N'';

    /* Reseed identity columns so the next row starts from 1. */
    SELECT @sql = @sql +
        N'DBCC CHECKIDENT (''[dbo].' + QUOTENAME(t.TableName) + N''', RESEED, 0) WITH NO_INFOMSGS;' + CHAR(10)
    FROM @TargetTables t
    WHERE OBJECT_ID(N'[dbo].' + QUOTENAME(t.TableName), N'U') IS NOT NULL
      AND EXISTS (
          SELECT 1
          FROM sys.identity_columns ic
          WHERE ic.object_id = OBJECT_ID(N'[dbo].' + QUOTENAME(t.TableName), N'U')
      );

    IF LEN(@sql) > 0
        EXEC sp_executesql @sql;

    SET @sql = N'';

    /* Re-enable and re-check constraints. */
    SELECT @sql = @sql +
        N'ALTER TABLE [dbo].' + QUOTENAME(t.TableName) + N' WITH CHECK CHECK CONSTRAINT ALL;' + CHAR(10)
    FROM @TargetTables t
    WHERE OBJECT_ID(N'[dbo].' + QUOTENAME(t.TableName), N'U') IS NOT NULL;

    IF LEN(@sql) > 0
        EXEC sp_executesql @sql;

    COMMIT TRAN;
    PRINT 'Data cleanup complete. Schema preserved and identities reseeded.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorNumber INT = ERROR_NUMBER();
    DECLARE @ErrorLine INT = ERROR_LINE();

    RAISERROR('cleanup_data_reseed.sql failed. Number: %d, Line: %d, Message: %s', 16, 1, @ErrorNumber, @ErrorLine, @ErrorMessage);
END CATCH;
