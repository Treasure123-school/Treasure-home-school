# Production Deployment Guide - Treasure-Home School Management System

## 🚨 Critical Issues & Solutions

### Issue Summary
Your Render production deployment is missing required environment variables, causing:
- ❌ Authentication failures (only treasurehomeschool@gmail.com works)
- ❌ File upload failures (hero images, galleries)
- ❌ Dashboard data not loading
- ❌ CORS errors blocking frontend-backend communication

## Required Environment Variables for Render (Backend)

### ⚠️ CRITICAL - Must Set These in Render Dashboard

Go to your Render backend service → **Environment** tab and add these variables:

#### 1. **NODE_ENV** (Required)
```
NODE_ENV=production
```

#### 2. **FRONTEND_URL** (Required - CRITICAL for CORS)
```
FRONTEND_URL=https://your-vercel-app.vercel.app
```
⚠️ Replace with your actual Vercel frontend URL
⚠️ This MUST match your Vercel deployment URL exactly (no trailing slash)

#### 3. **BACKEND_URL** (Required - for OAuth redirects)
```
BACKEND_URL=https://your-render-backend.onrender.com
```
⚠️ Replace with your actual Render backend URL

#### 4. **DATABASE_URL** (Required - Already set)
```
DATABASE_URL=postgresql://user:password@host:port/database
```
✅ This should already be configured from your Supabase/Neon database

#### 5. **JWT_SECRET** (Required - Generate new for production)
```bash
# Generate a secure secret:
openssl rand -base64 48
```
Then set in Render:
```
JWT_SECRET=<your-generated-secret-here>
```

#### 6. **SESSION_SECRET** (Required - Generate new for production)
```bash
# Generate a different secret:
openssl rand -base64 48
```
Then set in Render:
```
SESSION_SECRET=<your-generated-secret-here>
```

#### 7. **SUPABASE_URL** (Required - for file uploads)
```
SUPABASE_URL=https://your-project.supabase.co
```
⚠️ Get this from your Supabase Dashboard → Project Settings → API

#### 8. **SUPABASE_SERVICE_KEY** (Required - for file uploads)
```
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
⚠️ Get this from Supabase Dashboard → Project Settings → API → service_role key (NOT anon key!)

#### 9. **GOOGLE_CLIENT_ID** (Required for Google OAuth)
```
GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxxx.apps.googleusercontent.com
```
⚠️ Get from Google Cloud Console → Credentials

#### 10. **GOOGLE_CLIENT_SECRET** (Required for Google OAuth)
```
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
```
⚠️ Get from Google Cloud Console → Credentials

---

## Google OAuth Configuration (CRITICAL)

### Step 1: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under **Authorized redirect URIs**, add:
   ```
   https://your-render-backend.onrender.com/api/auth/google/callback
   ```
   ⚠️ Replace with your actual Render backend URL

### Step 2: Verify Callback URL
The system will automatically use `BACKEND_URL + /api/auth/google/callback` for OAuth redirects.

---

## Frontend Environment Variables (Vercel)

Go to your Vercel project → **Settings** → **Environment Variables**:

### Required Variable:
```
VITE_API_URL=https://your-render-backend.onrender.com
```
⚠️ Replace with your actual Render backend URL
⚠️ No trailing slash!

---

## 🔍 Verification Checklist

After setting all environment variables, verify your deployment:

### 1. Check Render Logs for Environment Validation
Look for this in your Render deployment logs:
```
✅ All required environment variables are properly configured!
```

If you see errors like:
```
❌ MISSING (PRODUCTION): FRONTEND_URL
❌ MISSING (PRODUCTION): BACKEND_URL
```
Then those variables are not set correctly.

### 2. Test CORS
Open your Vercel frontend and check browser console. You should NOT see:
```
Access to fetch at 'https://...' from origin '...' has been blocked by CORS policy
```

### 3. Test Google OAuth
Try signing in with a Google account. It should work now.

### 4. Test File Uploads
Try uploading a hero image in the admin dashboard. It should work now.

---

## 🐛 Troubleshooting

### Problem: "Authentication Failed" for Google Login
**Cause**: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET
**Solution**: Set both variables in Render environment

### Problem: "CORS Error" in Browser
**Cause**: Missing or incorrect FRONTEND_URL
**Solution**: 
1. Set FRONTEND_URL in Render to your exact Vercel URL
2. Redeploy Render backend
3. Clear browser cache and try again

### Problem: File Uploads Not Working
**Cause**: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY
**Solution**: 
1. Get both values from Supabase Dashboard
2. Set in Render environment variables
3. Redeploy

### Problem: Dashboard Data Not Loading
**Cause**: Either CORS or authentication issues
**Solution**:
1. Verify FRONTEND_URL is set correctly
2. Verify BACKEND_URL is set correctly
3. Check browser console for specific errors
4. Check Render logs for CORS rejection messages

---

## 📋 Quick Setup Script

Run this in your terminal to generate secrets:

```bash
# Generate JWT_SECRET
echo "JWT_SECRET=$(openssl rand -base64 48)"

# Generate SESSION_SECRET  
echo "SESSION_SECRET=$(openssl rand -base64 48)"
```

Copy the output and add to Render environment variables.

---

## 🚀 Deployment Steps

1. ✅ Set all environment variables in Render (10 variables total)
2. ✅ Update Google OAuth redirect URI in Google Cloud Console
3. ✅ Set VITE_API_URL in Vercel
4. ✅ Redeploy Render backend (it will auto-deploy when you save env vars)
5. ✅ Redeploy Vercel frontend
6. ✅ Test authentication, file uploads, and dashboard
7. ✅ Check Render logs for "✅ All required environment variables are properly configured!"

---

## 📞 Support

If you continue to have issues:
1. Check Render logs for specific error messages
2. Check browser console for CORS/authentication errors
3. Verify all environment variables are set exactly as shown above
4. Make sure there are no trailing slashes in URLs
5. Ensure FRONTEND_URL and BACKEND_URL match your actual deployment URLs

---

## ⚠️ Security Notes

- Never commit secrets to git
- Use different secrets for development and production
- Keep SUPABASE_SERVICE_KEY secure (it has admin access)
- Regenerate secrets if they are ever exposed
