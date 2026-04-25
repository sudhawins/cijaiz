# Tables Inventory

This document lists database tables used in this project, based on SQL scripts in `Scripts/` and SQL queries in `server/routes`, `server/services`, and `server/server.js`.

## Scope

- Active runtime tables: tables referenced by backend code.
- Schema tables: tables created/altered by SQL scripts.
- Legacy/auxiliary tables: tables found in historical DDL that are not part of the primary e-commerce flow.

## Active Runtime Tables (Backend-Referenced)

### Commerce
- `categories`
- `products`
- `product_images`
- `cart_items`
- `orders`
- `order_items`
- `search_history`
- `wishlist` (used by API, but no create-table migration found in `Scripts/`)

### Discounts and Rewards
- `discounts`
- `customer_rewards`
- `reward_transactions`
- `order_discounts`

### Auth and Roles
- `[User]`
- `UserRole`
- `RoleDetail`

### Shipping
- `cities`
- `shipping_zones`

## Schema Tables Found in SQL Scripts

### Core E-commerce Schema
- `categories`
- `products`
- `product_images`
- `cart_items`
- `orders`
- `order_items`
- `search_history`

Primary source: `Scripts/ecommerce.sql`.

### Discounts/Rewards Schema
- `discounts`
- `customer_rewards`
- `reward_transactions`
- `order_discounts`

Primary source: `Scripts/discounts_rewards_schema.sql`.

### Shipping Schema
- `cities`
- `shipping_zones`

Primary source: `Scripts/create_cities_shipping_tables.sql`.

### User/Role Schema (legacy DDL script, still referenced by backend)
- `[User]`
- `UserRole`
- `RoleDetail`
- `__MigrationHistory`

Primary source: `Scripts/mansion_ddl_scripts_03_10_2026.sql`.

### Additional Legacy/Auxiliary Tables from DDL
- `CollectionReminder`
- `CollectionVerification`
- `Complains`
- `ComplaintStatus`
- `ComplainType`
- `ConsignmentImport`
- `ConsignmentMasters`
- `DailyRoomStatus`
- `DailyRoomStatusMedia`
- `EBServicePayments`
- `Occupancy`
- `RentalCollection`
- `RoomDetail`
- `ServiceConsumptionDetails`
- `ServiceDetails`
- `ServiceRoomAllocation`
- `StockDetails`
- `[Table]`
- `Tables`
- `Tenant`
- `Tenants`
- `Transactions`
- `TransactionType`

Primary source: `Scripts/mansion_ddl_scripts_03_10_2026.sql`.

## Important Notes

- `wishlist` is used in backend routes (`server/routes/wishlist.js`) but no corresponding create-table script is present in `Scripts/`.
- Some scripts alter existing tables (for example, adding seller, rewards, order charge, and shipping fields). The table list above is consolidated and deduplicated.

## Suggested Minimal Wishlist Table (Missing Migration)

If needed, add a migration for:

- `wishlist(id, user_id, product_id, created_at)`
- Unique key on `(user_id, product_id)`
- FK `user_id -> [User](Id)`
- FK `product_id -> products(id)`

## Cleanup Scripts

- Full schema cleanup (drops constraints and tables): `Scripts/cleanup_all_tables.sql`
- Data-only cleanup (keeps schema, clears rows, reseeds identities): `Scripts/cleanup_data_reseed.sql`
