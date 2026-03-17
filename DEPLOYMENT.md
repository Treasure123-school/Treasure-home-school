# Deployment Guide: Render (Backend) + Vercel (Frontend)

This guide will help you deploy your Treasure Home School Management System with the backend on Render and frontend on Vercel.

## Architecture Overview

- **Backend (Render)**: Express.js server with PostgreSQL database
- **Frontend (Vercel)**: React/Vite SPA with optimized build
- **Database**: Supabase PostgreSQL (already configured)

## Prerequisites

1. GitHub account (to push your code)
2. Render account ([render.com](https://render.com))
3. Vercel account ([vercel.com](https://vercel.com))
4. Supabase project with DATABASE_URL (already configured)

---

## Part 1: Deploy Backend to Render

### Step 1: Push Code to GitHub

```bash
git add .
git commit -m "Prepare for Render + Vercel deployment"
git push origin main
```

### Step 2: Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `treasure-home-backend` (or your choice)
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: Free or paid tier

### Step 3: Configure Environment Variables

The `render.yaml` file automatically configures most environment variables, but you need to add:

**Required Variables** (add manually in Render dashboard):

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `your-supabase-connection-string` | From Supabase dashboard |
| `FRONTEND_URL` | `https://your-app.vercel.app` | Add after Vercel deployment |

**Auto-Generated** (by Render):
- `SESSION_SECRET` - Automatically generated secure random value
- `JWT_SECRET` - Automatically generated secure random value

**Optional** (for Google OAuth):

| Variable | Value | Notes |
|----------|-------|-------|
| `GOOGLE_CLIENT_ID` | `your-google-oauth-client-id` | Optional: for Google login |
| `GOOGLE_CLIENT_SECRET` | `your-google-oauth-secret` | Optional: for Google login |
| `GOOGLE_REDIRECT_URI` | `https://your-backend.onrender.com/api/auth/google/callback` | Optional |

**To generate secrets:**
```bash
# On Linux/Mac
openssl rand -base64 48

# Or use online generator
https://www.random.org/strings/
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Note your backend URL: `https://your-backend.onrender.com`
4. Test health endpoint: `https://your-backend.onrender.com/api/health`

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Prepare Vercel Configuration

The `vercel.json` file is already configured in your project.

### Step 2: Deploy to Vercel

**Option A: Via Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel --prod
```

**Option B: Via Vercel Dashboard**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Other (custom configuration)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/public`
   - **Install Command**: `npm install`

### Step 3: Configure Frontend Environment Variables

Add this environment variable in Vercel:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | `https://your-backend.onrender.com` | Your Render backend URL |

**How to add in Vercel:**
1. Go to Project Settings → Environment Variables
2. Add `VITE_API_URL` with your Render backend URL
3. Redeploy: `vercel --prod`

### Step 4: Update Backend with Frontend URL

Go back to Render and update the `FRONTEND_URL` environment variable:
- Set it to your Vercel URL: `https://your-app.vercel.app`
- This enables CORS for your frontend

---

## Part 3: Final Configuration

### Update Google OAuth (if using)

If you're using Google authentication:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Update OAuth 2.0 Client:
   - **Authorized JavaScript origins**: Add `https://your-app.vercel.app`
   - **Authorized redirect URIs**: Add `https://your-backend.onrender.com/api/auth/google/callback`

### Test Your Deployment

1. Visit your Vercel frontend: `https://your-app.vercel.app`
2. Test login functionality
3. Test API connectivity
4. Verify database operations

---

## Troubleshooting

### CORS Issues
**Error**: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solution**:
- Ensure `FRONTEND_URL` is set in Render environment variables
- Verify it matches your Vercel URL exactly (including https://)
- Redeploy Render service after updating

### 502 Bad Gateway on Render
**Error**: Backend returns 502 errors

**Solution**:
- Check Render logs for errors
- Verify `DATABASE_URL` is correct
- Ensure all required environment variables are set
- Check if Supabase connection pooler is accessible

### Frontend Can't Reach Backend
**Error**: "Network request failed" or "Failed to fetch"

**Solution**:
- Verify `VITE_API_URL` in Vercel matches Render backend URL
- Ensure Render service is running (check dashboard)
- Test backend health endpoint: `https://your-backend.onrender.com/api/health`

### Database Migration Issues
**Error**: "Migration failed" in Render logs

**Solution**:
- Migrations run automatically on startup
- Check if DATABASE_URL has correct format
- Verify Supabase database is accessible from Render

---

## Monitoring & Logs

### Render Logs
- Dashboard → Your Service → Logs
- Shows server startup, API requests, and errors

### Vercel Logs
- Dashboard → Your Project → Deployments → View Function Logs
- Shows build logs and runtime errors

### Database Logs
- Supabase Dashboard → Your Project → Logs
- Shows database queries and errors

---

## Cost Optimization

### Render Free Tier
- **Limitations**: Spins down after 15 minutes of inactivity, 750 hours/month
- **Upgrade**: $7/month for always-on service
- **Tip**: Free tier is fine for testing, but may have cold starts

### Vercel Free Tier
- **Limitations**: 100 GB bandwidth/month, 6000 build minutes/month
- **Upgrade**: $20/month for Pro tier
- **Tip**: Free tier is generous for most school applications

---

## Security Checklist

- [ ] Strong `SESSION_SECRET` and `JWT_SECRET` (64+ characters)
- [ ] Database credentials secured (not in code)
- [ ] CORS configured correctly (only your frontend URL)
- [ ] HTTPS enforced (automatic on Render/Vercel)
- [ ] Google OAuth credentials secured (if used)
- [ ] Supabase connection uses SSL (`?sslmode=require`)

---

## Maintenance

### Update Code
```bash
# Make changes locally
git add .
git commit -m "Update description"
git push origin main

# Both Render and Vercel auto-deploy on push
```

### Manual Redeploy
- **Render**: Dashboard → Service → Manual Deploy
- **Vercel**: Dashboard → Project → Redeploy

### Database Backups
- **Supabase**: Automatic backups on paid tier
- **Manual**: Export from Supabase dashboard

---

## Support

For issues:
1. Check Render/Vercel logs
2. Review this guide's Troubleshooting section
3. Verify all environment variables are set correctly
4. Test backend health endpoint
5. Check CORS configuration

---

**Deployment Complete! 🎉**

Your school management system is now live with:
- Backend: `https://your-backend.onrender.com`
- Frontend: `https://your-app.vercel.app`
