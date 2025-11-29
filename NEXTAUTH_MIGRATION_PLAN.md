# NextAuth Migration Plan

## Overview
Migrate from custom JWT authentication to NextAuth.js v5 (Auth.js) for better security and built-in features.

## Benefits
- ✅ Built-in session management
- ✅ Better security (CSRF protection, secure cookies)
- ✅ Multiple provider support (Credentials, OAuth, etc.)
- ✅ TypeScript support
- ✅ Server-side session handling
- ✅ Automatic token refresh

## Steps to Migrate

### 1. Install NextAuth v5
```bash
npm install next-auth@beta
```

### 2. Create NextAuth Configuration
- Create `src/app/api/auth/[...nextauth]/route.ts`
- Configure Credentials provider for MySQL
- Keep existing user database structure

### 3. Update API Routes
- Replace `verifyToken()` with `getServerSession()`
- Update all protected routes to use NextAuth session

### 4. Update Frontend
- Replace custom login with NextAuth `signIn()`
- Use `useSession()` hook instead of custom state
- Update session checks

### 5. Environment Variables
- Add `NEXTAUTH_SECRET`
- Add `NEXTAUTH_URL`

## Migration Complexity
- **Medium**: Requires updating ~10-15 files
- **Time Estimate**: 2-4 hours
- **Breaking Changes**: Yes, but can be done incrementally

## Current vs NextAuth

### Current (Custom JWT)
- Manual token management
- Custom cookie handling
- Manual session verification
- Custom login/logout

### NextAuth
- Automatic session management
- Built-in secure cookies
- Server-side session verification
- Built-in signIn/signOut functions


