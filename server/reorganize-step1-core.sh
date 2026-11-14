#!/bin/bash
# SERVER REORGANIZATION - STEP 1: CORE INFRASTRUCTURE
# Execute this script to move core files to proper locations
# Run from: /public/Treasure-home-school/server

set -e

echo "🚀 Starting Phase 1: Core Infrastructure Organization"
echo ""

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p core/{config,middleware,utils}
mkdir -p shared/{types,enums}
mkdir -p infrastructure/{cache,monitoring,email,storage,realtime}

# Move config files
echo "📦 Moving config files..."
mv db.ts core/config/database.ts 2>/dev/null || echo "  - db.ts already moved or not found"
mv env-validation.ts core/config/env-validation.ts 2>/dev/null || echo "  - env-validation.ts already moved"

# Move utilities
echo "🔧 Moving utilities..."
mv auth-utils.ts core/utils/auth-utils.ts 2>/dev/null || echo "  - auth-utils.ts already moved"

# Move infrastructure services
echo "⚙️ Moving infrastructure services..."
mv enhanced-cache.ts infrastructure/cache/enhanced-cache.ts 2>/dev/null || echo "  - enhanced-cache.ts already moved"
mv performance-cache.ts infrastructure/cache/performance-cache.ts 2>/dev/null || echo "  - performance-cache.ts already moved"
mv performance-monitor.ts infrastructure/monitoring/performance-monitor.ts 2>/dev/null || echo "  - performance-monitor.ts already moved"
mv query-optimizer.ts infrastructure/monitoring/query-optimizer.ts 2>/dev/null || echo "  - query-optimizer.ts already moved"
mv database-optimization.ts infrastructure/monitoring/database-optimization.ts 2>/dev/null || echo "  - database-optimization.ts already moved"
mv email-service.ts infrastructure/email/email-service.ts 2>/dev/null || echo "  - email-service.ts already moved"
mv cloudinary-service.ts infrastructure/storage/cloudinary-service.ts 2>/dev/null || echo "  - cloudinary-service.ts already moved"
mv realtime-service.ts infrastructure/realtime/realtime-service.ts 2>/dev/null || echo "  - realtime-service.ts already moved"

echo ""
echo "✅ Phase 1 Complete!"
echo ""
echo "Next Steps:"
echo "1. Update imports in index.ts and routes.ts"
echo "2. Run: npm run build (to check for import errors)"
echo "3. Fix any import paths"
echo "4. Test server starts: npm run dev"
echo ""
echo "Then run: ./reorganize-step2-storage.sh"
