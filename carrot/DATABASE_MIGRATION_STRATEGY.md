# Database Migration Strategy

## Overview
This document outlines the proper workflow for managing database schema changes in the Carrot application to prevent schema drift and ensure data integrity.

## Current Status ✅
- Database is now synchronized with Prisma schema
- All missing fields have been added to `discoveredContent` table
- API routes are working correctly

## Migration Workflow

### 1. Development Workflow
```bash
# 1. Make changes to prisma/schema.prisma
# 2. Create and apply migration
npx prisma migrate dev --name descriptive_migration_name

# 3. Generate Prisma client
npx prisma generate
```

### 2. Production Deployment
```bash
# 1. Apply pending migrations
npx prisma migrate deploy

# 2. Generate Prisma client
npx prisma generate
```

### 3. Emergency Schema Sync (Development Only)
```bash
# Use ONLY when migrations are out of sync
# This will ADD missing fields without deleting data
npx prisma db push
```

## Best Practices

### ✅ DO:
- Always use `prisma migrate dev` for schema changes
- Use descriptive migration names
- Test migrations in development first
- Use `prisma migrate deploy` in production
- Keep migration files in version control

### ❌ DON'T:
- Manually edit database schema outside of Prisma
- Use `prisma db push` in production
- Delete migration files
- Skip testing migrations

## Schema Validation Tools

### Built-in Health Checks
- `/api/health/db` - Basic database connectivity
- `/api/dev/admin/schema-health` - Schema validation (dev only)
- `/api/dev/admin/db-compare-prisma` - Compare schema vs database (dev only)

### Manual Validation
```bash
# Check migration status
npx prisma migrate status

# Compare schema with database
npx prisma db pull --print
```

## Troubleshooting

### Schema Drift Detection
If you see "Drift detected" errors:
1. **DO NOT** use `prisma migrate reset` (deletes all data)
2. Use `prisma db push` to sync schema (development only)
3. Create proper migration files for production

### Missing Fields Error
If you get "field does not exist" errors:
1. Check if field exists in Prisma schema
2. Run `npx prisma db push` to add missing fields
3. Verify with `npx prisma migrate status`

### Production Issues
- Never reset production database
- Always backup before migrations
- Test migrations in staging first
- Use `prisma migrate deploy` for production

## Monitoring

### Regular Checks
- Run `npx prisma migrate status` weekly
- Monitor application logs for schema errors
- Use health check endpoints in monitoring

### Alert Conditions
- Migration status shows drift
- API returns "field does not exist" errors
- Database connection failures

## Recovery Procedures

### If Schema is Out of Sync
1. **Development**: Use `npx prisma db push`
2. **Production**: Create and apply proper migration
3. **Emergency**: Contact database administrator

### If Data is Lost
1. Restore from latest backup
2. Replay migrations from backup point
3. Verify data integrity

## Future Improvements
- Set up automated schema validation in CI/CD
- Implement database backup automation
- Add schema change notifications
- Create rollback procedures for failed migrations
