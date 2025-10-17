# DATABASE SAFETY PROTOCOL

## CRITICAL: Data Protection Rules

### NEVER RUN WITHOUT EXPLICIT USER PERMISSION:
- `npx prisma db push --force-reset`
- `npx prisma migrate reset`
- `DROP TABLE` or `DELETE FROM` commands
- Any command with `--force`, `--reset`, or similar destructive flags
- SQLite `.backup` or database replacement commands

### REQUIRED BEFORE ANY SCHEMA CHANGES:
1. **Create backup**: Run `node backup-database.js`
2. **Get user permission**: Ask explicitly before destructive operations
3. **Use safe migrations**: Prefer `npx prisma migrate dev` over `db push --force-reset`

### AUTOMATIC BACKUP TRIGGERS:
- Before any Prisma schema changes
- Before running migration commands
- Weekly automated backups (implement)

### DATA RECOVERY:
- Backups stored in `carrot/` directory with timestamps
- Use `fs.copyFileSync(backupPath, 'dev.db')` to restore

### INCIDENT PREVENTION:
- Always verify database contents before changes
- Use `prisma studio` to inspect data first
- Test schema changes on copy of database
- Document all database operations

## CURRENT STATUS:
- Database was accidentally reset, all user data lost
- User @daniel's onboarding data (username, profilePhoto) deleted
- Backup system now implemented to prevent future incidents
