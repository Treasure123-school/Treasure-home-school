# 🏠 Self-Hosted Database Guide - Complete Instructions

## Overview

Your application is **NOT locked to Replit**. You can run it anywhere with a PostgreSQL database. This guide shows you exactly how.

---

## 🎯 Key Understanding

### **What You Own:**

✅ **Schema (Table Definitions)** - In your code
```
shared/schema.ts  ← Contains all 50+ table definitions
```

✅ **Application Code** - In your code
```
server/  ← Backend code
client/  ← Frontend code
```

✅ **Data** - Can be exported and migrated

### **What's Cloud-Dependent:**

⚠️ **Current Database Host** - Currently on Replit's cloud
- But this can be changed anytime
- Takes 5 minutes to switch

---

## 📋 How Your App Connects to Database

**Connection String (DATABASE_URL):**
```
postgresql://username:password@host:port/database_name
```

This tells your app "where to find the database"

---

## 🚀 How to Run Your App Off Replit

### **Step 1: Get Your PostgreSQL Database**

**Option A: Managed Database (Recommended for Beginners)**
- DigitalOcean Database
- AWS RDS
- Railway.app
- Heroku Postgres
- Neon (same as Replit uses)

**Option B: Self-Hosted Database**
- Install PostgreSQL on your server
- Install PostgreSQL on your personal computer
- Docker container with PostgreSQL

### **Step 2: Get the Connection String**

Your database provider will give you a connection string like:
```
postgresql://user:password@db.example.com:5432/myapp
```

This is your `DATABASE_URL`

### **Step 3: Set the Environment Variable**

```bash
# On your server or local machine, create .env file:
DATABASE_URL="postgresql://user:password@db.example.com:5432/myapp"
```

### **Step 4: Run Your App**

```bash
npm install      # Install dependencies
npm run db:push  # Sync your schema to the new database (creates all 50+ tables)
npm run dev      # Start your app
```

**That's it!** Your app now uses your own database instead of Replit's!

---

## 🔄 Migration: Moving Data From Replit to Your Own Database

### **Step 1: Export Data From Replit**

```bash
# Connect to Replit database and export
# (Replit provides connection details in Database tab)

pg_dump postgresql://replit_user:pass@replit.neon.tech:5432/replit_db > backup.sql
```

### **Step 2: Create New Database**

On your database provider (DigitalOcean, AWS, etc.):
- Create new PostgreSQL database
- Get the connection string

### **Step 3: Import Data**

```bash
# Import your backup to new database
psql -U newuser -h new-host -d newdb -f backup.sql
```

### **Step 4: Update Connection String**

```bash
# Change DATABASE_URL in your .env
DATABASE_URL="postgresql://newuser:newpass@new-host:5432/newdb"
```

### **Step 5: Test**

```bash
npm run dev
# Visit http://localhost:3000 (or your port)
# All your data should be there!
```

---

## 📦 Deployment Options

### **Option 1: DigitalOcean (Easiest for Beginners)**

**Database Cost:** $12/month
**App Cost:** $4-6/month (for hosting)
**Total:** ~$16-18/month

**Steps:**
1. Create DigitalOcean account
2. Create PostgreSQL database
3. Deploy Node.js app on DigitalOcean
4. Set DATABASE_URL in environment
5. Done!

### **Option 2: Railway.app**

**Cost:** $5-20/month (all-in-one)

**Steps:**
1. Connect GitHub repo
2. Add PostgreSQL plugin
3. Deploy automatically
4. Done!

### **Option 3: Heroku (Legacy)**

**Cost:** $7-50/month

### **Option 4: Fly.io**

**Cost:** $5-25/month

### **Option 5: Self-Hosted (Most Control, Most Work)**

**Cost:** $5-200/month (server cost)

**Requires:**
- Linux server knowledge
- Docker (recommended)
- Database backup management

---

## 📝 Your Schema is Yours - Complete Table List

All these tables are defined in `shared/schema.ts` and will be created on ANY PostgreSQL database:

```sql
-- These 50+ tables will be created automatically when you run:
-- npm run db:push

-- Core tables
roles
users
user_sessions
user_metadata

-- Academic tables
academic_terms
classes
students
teachers
student_classes
teacher_classes

-- Assessment tables
exams
exam_questions
question_options
exam_sessions
student_answers
exam_results
question_banks
question_bank_items
question_bank_options

-- Records
attendance
report_cards
marks
grades

-- Communication
announcements
announcement_read_status
messages
notifications
notification_preferences

-- Content
home_page_content
home_page_content_media
gallery
gallery_images
study_resources
study_resource_files

-- Admin
system_settings
audit_logs
error_logs
user_activity_logs

-- And more...
```

**All of these are portable!** They'll be created in any PostgreSQL database.

---

## ⚡ Quick Start: Local Development

### **Run Your App Locally (No Cloud Needed)**

```bash
# 1. Install PostgreSQL locally
# (Download from postgresql.org)

# 2. Create local database
createdb myapp

# 3. Set environment variable
export DATABASE_URL="postgresql://localhost:5432/myapp"

# 4. Sync schema
npm run db:push

# 5. Start app
npm run dev
```

Your app now runs on `http://localhost:5000` with your local database!

---

## 🛡️ Security Best Practices

### **Connection String Security**

**❌ DON'T:**
```
DATABASE_URL in your code
DATABASE_URL in version control
DATABASE_URL in commit messages
```

**✅ DO:**
```
Store in .env file (local only)
Store in server environment variables
Store in deployment platform's secret manager
Use strong passwords
Use network restrictions where possible
```

### **Password Security**

```bash
# Good password
PostgreSQL-MyApp@2024#Secure123!

# Bad password
password123
admin
12345
```

---

## 🔍 Troubleshooting

### **Error: "Connection refused"**
- Database server not running
- Wrong host address
- Wrong port
- Firewall blocking connection

### **Error: "Database does not exist"**
- Need to create database first
- Wrong database name in connection string

### **Error: "Invalid password"**
- Wrong username or password
- Check your DATABASE_URL

### **Tables not created**
```bash
# Run this to create all tables
npm run db:push
```

### **Data not showing up**
- Did you import the backup?
- Is the connection string correct?
- Are you connecting to right database?

---

## 📊 Comparison: Replit vs Self-Hosted

| Feature | Replit | Self-Hosted |
|---------|--------|-------------|
| **Cost** | Included | $4-200/month |
| **Setup** | 1 click | 15-30 min |
| **Maintenance** | None | You manage |
| **Backups** | Replit handles | You manage |
| **Scalability** | Limited | Unlimited |
| **Portability** | Can leave anytime | Portable |
| **Control** | Limited | Full control |

---

## ✅ Complete Checklist: Moving Off Replit

- [ ] Decide where database will be hosted
- [ ] Create PostgreSQL database
- [ ] Get CONNECTION_STRING from provider
- [ ] Export data from Replit (if needed)
- [ ] Import data to new database (if needed)
- [ ] Create `.env` file with new DATABASE_URL
- [ ] Run `npm run db:push` to create/sync tables
- [ ] Run `npm run dev` to test
- [ ] Deploy application to your host
- [ ] Set DATABASE_URL on production server
- [ ] Test that everything works

---

## 🎓 Key Points to Remember

1. **Your schema is in `shared/schema.ts`** - You own it
2. **Connection string is the ONLY thing that changes** - Just one line
3. **Everything else stays the same** - No code changes needed
4. **Database is portable** - Works with any PostgreSQL
5. **Tables are created by Drizzle** - Just run `npm run db:push`
6. **Data can be exported** - Use `pg_dump` to backup and migrate
7. **You're NOT locked to Replit** - Leave anytime!

---

## 🚀 What's Next?

### **If staying on Replit for now:**
✅ Keep using included PostgreSQL
✅ No action needed
✅ Can migrate anytime in future

### **If moving off Replit:**
1. Choose a database provider
2. Create database
3. Get connection string
4. Update `.env` file
5. Run `npm run db:push`
6. Start your app!

---

## 📞 Support Resources

**PostgreSQL Documentation:**
- https://www.postgresql.org/docs/

**Drizzle ORM Documentation:**
- https://orm.drizzle.team/docs/get-started

**Database Providers:**
- DigitalOcean: https://www.digitalocean.com/products/managed-databases
- Railway: https://railway.app
- AWS RDS: https://aws.amazon.com/rds/postgresql/
- Fly.io: https://fly.io

---

## 🎉 Summary

**You have a fully portable application!**

- ✅ Schema in your code (you own it)
- ✅ Works with any PostgreSQL database
- ✅ Easy to move between providers
- ✅ NO vendor lock-in
- ✅ Complete control when needed

Your database is yours to take anywhere!
