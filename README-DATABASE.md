# Database Integration Guide

## ✅ Completed Features

1. ✅ MySQL database schema created
2. ✅ SQL script for MySQL Workbench
3. ✅ Database connection utilities
4. ✅ Login system with username, password, and project ID
5. ✅ API routes for all CRUD operations:
   - Authentication (login)
   - Projects
   - Documents (PDFs)
   - Annotations (lines/shapes)
   - Punch List Items
6. ✅ Frontend integrated with database
7. ✅ Auto-save annotations and punch items to database

## 📋 Setup Instructions

### 1. Database Setup

1. Open MySQL Workbench
2. Import `database/schema.sql`:
   - File > Run SQL Script
   - Select `database/schema.sql`
   - Execute

### 2. Environment Configuration

Create `.env.local` in project root:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bluebeam_prototype
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
```

### 3. Set Admin Password

The default admin password is `admin123`. To change it:

```bash
node database/setup-admin.js your_new_password
```

Or manually update in MySQL:
```sql
USE bluebeam_prototype;
-- Generate hash using bcrypt and update:
UPDATE users SET password = '$2b$10$...' WHERE username = 'admin';
```

### 4. Start Application

```bash
npm run dev
```

## 🔐 Login

- **Username**: `admin`
- **Password**: `admin123`
- **Project ID**: `PROJ-001` (optional, can leave empty)

## 📊 Database Structure

### Tables

1. **users** - User accounts
2. **projects** - Project information
3. **project_users** - User-project relationships
4. **documents** - PDF files
5. **annotations** - All lines/shapes/annotations on PDFs
6. **punch_list_items** - Punch list items

### Key Features

- ✅ All annotations (lines, shapes, text) are saved with positions
- ✅ PDF documents are linked to projects
- ✅ Punch items are automatically created from annotations
- ✅ User authentication with JWT tokens
- ✅ Project-based access control

## 🔄 How It Works

1. **Login**: User logs in with username, password, and optional project ID
2. **Load Data**: System fetches:
   - Project details
   - All documents in project
   - All annotations (lines/shapes)
   - All punch list items
3. **Create Annotation**: When you draw a line/shape:
   - Annotation is saved to database with position
   - Punch item is automatically created
   - Demarcation image is captured and saved
4. **Auto-save**: All changes are automatically saved to database

## 📝 API Endpoints

- `POST /api/auth/login` - Login
- `GET /api/projects/[projectId]` - Get project
- `PUT /api/projects/[projectId]` - Update project
- `GET /api/documents?projectId=...` - Get documents
- `POST /api/documents` - Create document
- `GET /api/annotations?projectId=...` - Get annotations
- `POST /api/annotations` - Create annotation
- `PUT /api/annotations/[id]` - Update annotation
- `DELETE /api/annotations/[id]` - Delete annotation
- `GET /api/punch-items?projectId=...` - Get punch items
- `POST /api/punch-items` - Create punch item
- `PUT /api/punch-items/[id]` - Update punch item
- `DELETE /api/punch-items/[id]` - Delete punch item

## 🎯 Usage Flow

1. Login with username, password, and project ID
2. System loads all project data
3. Upload or select a PDF document
4. Draw annotations (lines, shapes, etc.)
5. Annotations are automatically saved to database
6. Punch items are automatically created
7. All data persists across sessions

## ⚠️ Important Notes

- Change default admin password in production
- Update JWT_SECRET in production
- Ensure MySQL server is running
- Check database connection in `.env.local`



