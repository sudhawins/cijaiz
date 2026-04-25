# Quick Start Guide - Mansion Management System

## ⚡ 3-Minute Setup

### Step 1: Start Backend Server
```bash
cd backend
npm run dev
```
Backend runs on: `http://localhost:5000/api`

### Step 2: Start Frontend Server (New Terminal)
```bash
cd frontend
npm run dev
```
Frontend runs on: `http://localhost:3003`

### Step 3: Login with Demo Credentials
- **URL**: http://localhost:3003
- **Username**: `admin`
- **Password**: `admin123`

✅ You're now logged in!

---

## 📋 Main Features

### 🏠 Room Occupancy Dashboard
- View all rooms with occupancy status
- See current tenant information
- Track current month payments
- Search and filter rooms
- **To Access**: Click "Room Occupancy" button on home page

### 👥 Tenant Management
- Create/Edit/Delete tenants
- Upload tenant photos
- View occupied room details
- Search by name, phone, city, address
- **To Access**: Click "Tenant Management" button on home page

### 💰 Payment Tracking
- Track monthly rentals by month/year
- See payment status (paid/partial/pending)
- View summary statistics
- **To Access**: Click "Payment Tracking" button on home page

### 🔐 Authentication
- Login with username/password
- JWT token-based authentication
- Persistend session with localStorage
- Secure logout
- **Demo Accounts**:
  - admin / admin123
  - manager / manager123
  - user / user123

---

## 🔑 Demo Credentials

| Username | Password | Role |
|----------|-----------|------|
| admin | admin123 | Admin |
| manager | manager123 | Manager |
| user | user123 | User |

---

## 🗄️ Database Tables

The system uses the following tables:
- **Tenant**: User/occupant information
- **Occupancy**: Tenant → Room assignments
- **RoomDetail**: Room information (number, rent, beds)
- **RentalCollection**: Payment tracking (rent received/balance)

---

## 📱 Pages Overview

### Home Dashboard
- System status (Backend, Database)
- Navigation to other pages
- Quick access to all features
- User welcome message & logout

### Room Occupancy
- Statistics: Total rooms, occupied, vacant, occupancy rate
- Room cards with tenant info
- Current month payment status
- Search and filter capabilities

### Tenant Management
- List of all tenants with photos
- Occupied room details
- Current pending payments
- Add/edit/delete tenants
- Search by multiple fields

### Payment Tracking
- Monthly payment summary
- Tenant payment status breakdown
- Payment table with details
- Month/year selector

### Rental Collection
- Occupancy and payment data
- Unpaid tenant tracking

### Diagnostic
- System information
- Database schema inspection
- Sample data preview

---

## 🚀 API Endpoints

### Authentication
```
POST /api/auth/login
Headers: Content-Type: application/json
Body: { "username": "admin", "password": "admin123" }
Returns: { token, user }
```

### Room Occupancy
```
GET /api/rooms/occupancy
Headers: Authorization: Bearer {token}
Returns: Array of room objects with occupancy data
```

### Tenants
```
GET /api/tenants/with-occupancy
POST /api/tenants
PUT /api/tenants/:id
DELETE /api/tenants/:id
GET /api/tenants/search?field=name&query=John
```

### Payments
```
GET /api/rental/payments/:monthYear (format: YYYY-MM)
GET /api/rental/summary
```

---

## 🛠️ Development Notes

### Project Structure
```
reactdb/
├── backend/          # Express.js + TypeScript + MSSQL
│   ├── src/
│   │   ├── index.ts  (API endpoints)
│   │   └── database.ts (DB connection)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/         # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── components/ (React components)
│   │   ├── App.tsx
│   │   ├── api.ts (API client)
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── docker-compose.yml (Optional: For containerization)
```

### Key Files Modified
- `App.tsx` - AuthProvider integration, new routes
- `api.ts` - Login and room occupancy API functions
- `backend/index.ts` - New auth & room endpoints

### Key Files Created
- `AuthContext.tsx` - Authentication state management
- `LoginScreen.tsx` - Login UI component
- `RoomOccupancy.tsx` - Room occupancy dashboard
- Plus corresponding CSS files

---

## ⚙️ Troubleshooting

### "Cannot connect to backend"
```bash
# Check if backend is running on port 5000
netstat -ano | findstr :5000

# Backend should show in task list
tasklist | findstr node
```

### "Login returns 401"
- Verify credentials are correct
- Check VITE_API_URL in frontend config
- Verify backend is running

### "Room data not showing"
- Ensure database has RoomDetail records
- Check database connection in backend logs
- Inspect browser DevTools → Network tab

### "Styling looks broken"
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh Ctrl+Shift+R
- Restart dev servers

---

## 📊 Key Metrics Displayed

### Room Occupancy Dashboard
- **Total Rooms**: Count of all rooms
- **Occupied**: Rooms with active tenants
- **Vacant**: Rooms without tenants
- **Occupancy Rate**: Percentage of occupied rooms
- **Total Monthly Rent**: Sum of all room rents
- **Collected This Month**: Total rent received
- **Pending Payment**: Outstanding rent balances

---

## 🔒 Security

### Current
✅ JWT token authentication
✅ Token in Authorization header
✅ Session persistence

### Production Recommendations
🔶 Enable HTTPS
🔶 Use password hashing (bcrypt)
🔶 Implement refresh tokens
🔶 Add rate limiting
🔶 Role-based access control (RBAC)
🔶 httpOnly secure cookies for tokens

---

## 💡 Tips

1. **First time?** Use the demo admin account to explore all features
2. **Need to add data?** Use Tenant Management or database directly
3. **Checking payments?** Go to Payment Tracking and select a month
4. **Monitor occupancy?** Room Occupancy dashboard shows real-time status
5. **Search tip?** Use partial names/phone numbers in search fields

---

## 📞 Support

For detailed documentation, see:
- `AUTHENTICATION_AND_OCCUPANCY_GUIDE.md` - Full authentication docs
- `PaymentTracking_Guide.md` - Payment tracking details
- `TenantManagement_Guide.md` - Tenant management guide

---

**Ready to go!** 🚀

Start the servers and login with `admin/admin123` to explore the system.
