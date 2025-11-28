# 🚀 Quick Setup Guide

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Setup MySQL Database

1. **Open MySQL Workbench**
2. **Import Database Schema**:
   - File → Run SQL Script
   - Select `database/schema.sql`
   - Execute

3. **Set Admin Password** (Optional):
```bash
node database/setup-admin.js
```
Default password is `admin123`

## Step 3: Configure Environment

Create `.env.local` file in project root:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bluebeam_prototype
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
```

## Step 4: Start Application

```bash
npm run dev
```

## Step 5: Login

Open http://localhost:3000

- **Username**: `admin`
- **Password**: `admin123`
- **Project ID**: `PROJ-001` (optional)

## ✅ What's Included

- ✅ MySQL database schema
- ✅ Login system (username + password + project ID)
- ✅ Save PDF documents to database
- ✅ Save all annotations/lines with positions
- ✅ Auto-create punch items from annotations
- ✅ Fetch all data on login
- ✅ Full CRUD API for all entities

## 📁 Files Created

- `database/schema.sql` - MySQL database schema
- `database/setup-admin.js` - Admin password setup script
- `src/lib/db.ts` - Database connection
- `src/lib/auth.ts` - Authentication utilities
- `src/lib/api.ts` - API client functions
- `src/app/api/**` - All API routes
- `src/components/Login.tsx` - Login component
- Updated `src/app/page.tsx` - Database integration

## 🎯 How It Works

1. User logs in with username, password, and project ID
2. System fetches all project data from database:
   - Project details
   - PDF documents
   - All annotations (lines/shapes with positions)
   - All punch list items
3. When you create annotations, they're automatically saved to database
4. Punch items are auto-created and linked to annotations
5. All changes persist across sessions

## 🔧 Troubleshooting

**Database Connection Error:**
- Check MySQL is running
- Verify credentials in `.env.local`
- Ensure database exists: `SHOW DATABASES;`

**Login Fails:**
- Check admin user exists: `SELECT * FROM users WHERE username = 'admin';`
- Update password: `node database/setup-admin.js`

**Annotations Not Saving:**
- Check browser console for errors
- Verify API routes are working
- Check database connection

## 📚 More Information

See `README-DATABASE.md` for detailed documentation.





