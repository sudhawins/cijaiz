-- Clear all orders and related data
-- Delete from dependent tables first due to foreign key constraints

DELETE FROM reward_transactions WHERE order_id IN (SELECT id FROM orders);
DELETE FROM order_discounts WHERE order_id IN (SELECT id FROM orders);
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders);
DELETE FROM orders;

-- Verify all orders are deleted
SELECT COUNT(*) as remaining_orders FROM orders;
SELECT COUNT(*) as remaining_items FROM order_items;
SELECT COUNT(*) as remaining_discounts FROM order_discounts;

PRINT 'All orders and related data have been cleared!';