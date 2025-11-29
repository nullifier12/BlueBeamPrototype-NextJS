# Environment Variables Fix for EC2

## Issues Found:
1. `NEXTAUTH_URL='http://http://3.26.147.150'` - Has duplicate `http://`
2. `API_URL='http://http://3.26.147.150'` - Has duplicate `http://`

## Fix:
Update your `.env` file on EC2 server:

```env
NEXTAUTH_URL=http://3.26.147.150:3000
# OR if using port 3000 by default:
NEXTAUTH_URL=http://3.26.147.150:3000

# Remove the duplicate http:// from API_URL too
API_URL=http://3.26.147.150:3000
```

## NextAuth v5 Session Endpoint Error:
The error `UnknownAction: Cannot parse action at /api/auth/session` suggests NextAuth v5 might need a different configuration. The session endpoint should be automatically handled by `/api/auth/[...nextauth]`.


