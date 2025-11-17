# Database Setup Instructions

## Step 1: Import SQL Schema

1. Open MySQL Workbench
2. Connect to your MySQL server
3. Open the `database/schema.sql` file
4. Execute the script (or use File > Run SQL Script)

The script will:
- Create the `bluebeam_prototype` database
- Create all necessary tables
- Insert a default admin user

## Step 2: Set Default Admin Password

The default admin user is created with a placeholder password. You need to update it:

**Option A: Using MySQL Workbench**
```sql
USE bluebeam_prototype;
UPDATE users SET password = '$2b$10$rOzJqZqZqZqZqZqZqZqZqOqZqZqZqZqZqZqZqZqZqZqZqZqZqZq' WHERE username = 'admin';
```

**Option B: Using Node.js script**
Run this command in your project root:
```bash
node database/setup-admin.js
```

Or manually generate a bcrypt hash and update:
```sql
UPDATE users SET password = '<your_bcrypt_hash>' WHERE username = 'admin';
```

## Step 3: Configure Environment Variables

Create a `.env.local` file in the project root:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bluebeam_prototype
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
```

## Step 4: Test Connection

Start your Next.js development server:
```bash
npm run dev
```

Try logging in with:
- Username: `admin`
- Password: `admin123` (or the password you set)

## Default Credentials

- **Username**: `admin`
- **Password**: `admin123` (⚠️ Change this in production!)

## Database Schema Overview

- **users**: User accounts for authentication
- **projects**: Project information
- **project_users**: Many-to-many relationship between users and projects
- **documents**: PDF documents uploaded to projects
- **annotations**: All annotations/lines drawn on PDFs
- **punch_list_items**: Punch list items linked to annotations

## Troubleshooting

### Connection Error
- Check that MySQL is running
- Verify database credentials in `.env.local`
- Ensure the database exists: `SHOW DATABASES;`

### Authentication Error
- Verify the password hash is correct
- Check that the admin user exists: `SELECT * FROM users WHERE username = 'admin';`

### Permission Error
- Ensure the MySQL user has CREATE, INSERT, UPDATE, DELETE permissions

