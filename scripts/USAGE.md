# ESSTRAPIS Instance Creation - Quick Start

## Prerequisites
1. **Create DNS subdomain** (e.g., `newclient.esstrapis.org` → point to your VPS IP)
2. **Run migration once**: `./migrate-pm2-split.sh` (splits monolithic PM2 config)

## Create New Instance
```bash
./create-instance.sh --name newclient --domain newclient.esstrapis.org
```

**What it does:**
- Creates MySQL database & user (auto-generated secure password)
- Clones `buida` template structure
- Configures backend (PM2) & frontend (Docker)
- Sets up nginx with SSL certificate (certbot)
- Updates deploy scripts automatically
- Takes ~10 minutes ⏱️

## Common Options
```bash
# Dry-run (see what will happen without making changes)
./create-instance.sh --name test --domain test.esstrapis.org --dry-run

# Use different template
./create-instance.sh --name test --domain test.esstrapis.org --template demo

# Resume from specific phase (if something failed)
./create-instance.sh --name test --domain test.esstrapis.org --start-phase 6
```

## After Creation
- **Frontend**: https://newclient.esstrapis.org/stats/
- **Admin**: https://newclient.esstrapis.org/admin
- **Credentials**: `/var/www/projectes-newclient/INSTANCE_INFO.md`
- **Logs**: `pm2 logs strapi-projectes-newclient`

## Migrate Database Between Instances
Copy database from one instance to another with automatic domain replacement:
```bash
./migrate-database.sh --source buida --target newclient
```

This will:
- Backup the source database
- Restore to target (overwrites existing data!)
- Replace all domain references automatically
- Restart the target instance
