# NextAuth v5 Fix for EC2 Server

## Issues Found:
1. **Error**: `UnknownAction: Cannot parse action at /api/auth/session`
2. **Environment Variables**: Duplicate `http://` in `.env` file

## Fixes Needed:

### 1. Fix Environment Variables on EC2 Server

Update your `.env` file:

```env
# BEFORE (WRONG):
NEXTAUTH_URL='http://http://3.26.147.150'
API_URL='http://http://3.26.147.150'

# AFTER (CORRECT):
NEXTAUTH_URL=http://3.26.147.150:3000
# OR if using port 80:
NEXTAUTH_URL=http://3.26.147.150

API_URL=http://3.26.147.150:3000
```

### 2. NextAuth Configuration

Added `trustHost: true` to NextAuth config - this is required for NextAuth v5 in production environments.

### 3. Restart Server

After updating `.env`:
```bash
# Stop the server
pm2 stop all
# Or if using npm start, press Ctrl+C

# Restart
npm start
# Or
pm2 start npm --name "nextjs-app" -- start
```

## Why This Happens:

- NextAuth v5 requires `trustHost: true` for production
- The duplicate `http://` in NEXTAUTH_URL causes URL parsing errors
- The session endpoint error is likely due to incorrect NEXTAUTH_URL


