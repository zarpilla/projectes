# ESSTRAPIS Instance Automation

Automated deployment scripts for creating new ESSTRAPIS instances with database, backend (Strapi/PM2), frontend (Vue/Docker), nginx, and SSL configuration.

## Overview

These scripts automate the manual process documented in [new-site/new-site.txt](../new-site/new-site.txt), reducing instance creation from ~1 hour to ~10 minutes.

**What's automated:**
- ✅ MySQL database creation and structure cloning
- ✅ Backend (Strapi) setup with PM2 configuration
- ✅ Frontend (Vue) Docker container deployment
- ✅ Nginx configuration with reverse proxy
- ✅ SSL certificate via certbot
- ✅ Secure secret generation
- ✅ Port auto-discovery
- ✅ Integration with deploy scripts

**Manual step (required):**
- ⚠️ Create DNS subdomain before running (e.g., `newclient.esstrapis.org`)

## Architecture

### Current Setup (After Migration)
```
/home/webcoop/
├── pm2-apps/                          # Split PM2 configs (one per instance)
│   ├── strapi-projectes-webcoop.config.js
│   ├── strapi-projectes-demo.config.js
│   └── strapi-projectes-*.config.js
└── ecosystem.config.js.backup.*       # Backup of old monolithic config

/var/www/
├── projectes-buida/                   # Template instance
│   ├── projectes/                     # Backend (Strapi)
│   └── docker/                        # Frontend (Vue)
└── projectes-{instance}/              # Each new instance
    ├── projectes/                     # Backend
    ├── docker/                        # Frontend
    └── INSTANCE_INFO.md               # Generated documentation

/etc/nginx/sites-available/
└── projectes-{instance}               # Nginx config per instance
```

## Quick Start

### 1. One-Time PM2 Migration (Run First!)

**IMPORTANT:** Before creating new instances, migrate from monolithic to split PM2 config:

```bash
cd /home/jordi/Documents/work/webcoop/projectes/scripts
chmod +x migrate-pm2-split.sh
./migrate-pm2-split.sh
```

This will:
- Backup current `ecosystem.config.js`
- Split it into individual files in `~/pm2-apps/`
- Reload all PM2 processes with new configs
- Verify everything is running

**Expected output:**
```
Running processes: 15 / 15
All processes running successfully!
```

### 2. Create a New Instance

```bash
cd /home/jordi/Documents/work/webcoop/projectes/scripts
chmod +x create-instance.sh
./create-instance.sh --name newclient --domain newclient.esstrapis.org
```

**Prerequisites:**
1. DNS subdomain must exist and point to your VPS
2. Must run as `webcoop` user (has sudo access)
3. PM2 migration must be completed

**Interactive prompts:**
- MySQL admin password
- SMTP password (optional, uses default if skipped)
- Confirmation before proceeding

**Duration:** ~10 minutes depending on npm install time

### 3. Verify Instance

```bash
# Check PM2 backend
pm2 logs strapi-projectes-newclient

# Check Docker frontend
cd /var/www/projectes-newclient/docker
docker compose logs -f

# Access URLs
# Frontend: https://newclient.esstrapis.org/stats/
# Admin:    https://newclient.esstrapis.org/admin
# API:      https://newclient.esstrapis.org/api
```

## Script Reference

### Main Scripts

#### `create-instance.sh`
Main automation script for creating new instances.

**Usage:**
```bash
./create-instance.sh [OPTIONS]

Options:
  -n, --name <name>          Instance name (required)
  -d, --domain <domain>      Full domain (required)
  -t, --template <name>      Template to clone from (default: buida)
  --dry-run                  Show what would be done without executing
  -h, --help                 Show help
```

**Examples:**
```bash
# Standard instance
./create-instance.sh --name acme --domain acme.esstrapis.org

# Use different template
./create-instance.sh -n test -d test.esstrapis.org --template demo

# Dry-run to preview
./create-instance.sh -n preview -d preview.esstrapis.org --dry-run
```

**What it does:**
1. **Validation:** Checks DNS, ports, template existence
2. **Secrets:** Generates secure passwords and Strapi secrets
3. **Database:** Creates MySQL database and clones structure
4. **Files:** Copies template, initializes git repos
5. **Backend:** Creates PM2 config, installs deps, starts service
6. **Frontend:** Generates Docker .env, starts container
7. **Nginx:** Creates config, enables site, restarts nginx
8. **SSL:** Requests Let's Encrypt certificate via certbot
9. **Integration:** Updates deploy scripts
10. **Documentation:** Creates INSTANCE_INFO.md with all credentials

**Output:**
- Colored progress messages
- Log file: `/var/log/esstrapis-deploy/{instance}_{timestamp}.log`
- Documentation: `/var/www/projectes-{instance}/INSTANCE_INFO.md`

#### `migrate-pm2-split.sh`
One-time migration from monolithic to split PM2 config.

**Usage:**
```bash
./migrate-pm2-split.sh
```

**What it does:**
1. Backs up current `ecosystem.config.js`
2. Creates `~/pm2-apps/` directory
3. Stops all PM2 processes
4. Splits config into individual files
5. Reloads all processes from new configs
6. Verifies all instances running

**Safety:**
- Creates timestamped backup
- Validates before deleting old config
- Verifies all processes restart successfully

### Utility Scripts

#### `lib/generate-secrets.sh`
Generates cryptographically secure secrets for Strapi.

**Usage:**
```bash
# As standalone script
./lib/generate-secrets.sh

# Output example:
# DB_PASSWORD=xK9mP3nR...
# APP_KEY_1=4jH8N2qW...
# ...

# Source in another script
source lib/generate-secrets.sh
export_secrets  # Exports all secrets as env vars
```

**Functions:**
- `generate_secret()` - Single 32-byte base64 secret
- `generate_password(length)` - Random alphanumeric password
- `generate_all_secrets()` - All required Strapi secrets
- `export_secrets()` - Export secrets as environment variables

#### `lib/port-scanner.sh`
Finds available ports for new instances.

**Usage:**
```bash
# As standalone script
./lib/port-scanner.sh

# Output example:
# Currently used ports:
# === Backend Ports (PM2) ===
# 1337 1346 1347 ...
#
# === Frontend Ports (Docker) ===
# 8000 8001 8010 ...
#
# Next available ports:
#   Backend:  1359
#   Frontend: 8029

# Source in another script
source lib/port-scanner.sh
backend_port=$(find_next_backend_port)
frontend_port=$(find_next_frontend_port)
```

**Functions:**
- `find_next_backend_port()` - Scans 1337-1400
- `find_next_frontend_port()` - Scans 8000-9000
- `port_in_use(port)` - Checks if port is occupied
- `list_used_ports()` - Shows all currently used ports

**Port detection methods:**
1. `netstat` (if available)
2. `ss` (modern alternative)
3. `lsof` (fallback)
4. PM2 config file scanning (last resort)

### Templates

#### `templates/pm2-app.config.js.template`
Template for individual PM2 instance configuration.

**Placeholders:**
- `{{INSTANCE_NAME}}` - Instance identifier
- `{{INSTANCE_PATH}}` - Full path to instance directory
- `{{BACKEND_PORT}}` - PM2 port (1337+)
- `{{DOMAIN}}` - Full domain name
- `{{DB_*}}` - Database credentials
- `{{APP_KEY_*}}` - Strapi secrets (3 keys)
- `{{*_JWT_SECRET}}` - JWT secrets
- `{{EMAIL_*}}` - Email configuration
- `{{SMTP_*}}` - SMTP credentials

**Generated file:** `~/pm2-apps/strapi-projectes-{instance}.config.js`

#### `templates/nginx-site.conf.template`
Template for nginx site configuration.

**Placeholders:**
- `{{DOMAIN}}` - Server name
- `{{BACKEND_PORT}}` - Proxy to PM2 backend
- `{{FRONTEND_PORT}}` - Proxy to Docker frontend
- `{{INSTANCE_PATH}}` - Path for /vendor alias

**Locations:**
- `/` → Backend (Strapi API)
- `/stats` → Frontend (Vue app)
- `/vendor` → Static files from backend

**Generated file:** `/etc/nginx/sites-available/projectes-{instance}`

**Note:** SSL configuration is added by certbot after initial creation.

## Configuration

### Default Email Settings

Edit in `create-instance.sh`:
```bash
DEFAULT_EMAIL_FROM="hola@esstrapis.org"
DEFAULT_TASK_EMAIL_TO="*"
DEFAULT_SMTP_HOST="smtp.esstrapis.com"
DEFAULT_SMTP_PORT="465"
DEFAULT_SMTP_USER="hola@esstrapis.org"
```

### Default Paths

```bash
BASE_DIR="/var/www"
TEMPLATE_INSTANCE="buida"
LOG_DIR="/var/log/esstrapis-deploy"
PM2_APPS_DIR="$HOME/pm2-apps"
```

### Port Ranges

Edit in `lib/port-scanner.sh`:
```bash
# Backend: 1337-1400
# Frontend: 8000-9000
```

## Troubleshooting

### Migration Issues

**Problem:** PM2 processes won't start after migration
```bash
# Check individual config files
cat ~/pm2-apps/strapi-projectes-*.config.js

# Try starting individually
pm2 start ~/pm2-apps/strapi-projectes-demo.config.js

# Check logs
pm2 logs

# Restore from backup if needed
cp ~/ecosystem.config.js.backup.* ~/ecosystem.config.js
pm2 restart all
```

### Instance Creation Issues

**Problem:** DNS not resolving
```bash
# Check DNS
dig newclient.esstrapis.org
nslookup newclient.esstrapis.org

# Create subdomain in your DNS panel before running script
```

**Problem:** Port already in use
```bash
# List used ports
./lib/port-scanner.sh

# Check what's using a port
sudo lsof -i :1337
sudo netstat -tulpn | grep :8010

# Update port ranges if needed
```

**Problem:** MySQL access denied
```bash
# Verify admin credentials
mysql -u admin -p

# Check MySQL user
SELECT User, Host FROM mysql.user WHERE User='admin';

# Reset password if needed
sudo mysql
ALTER USER 'admin'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
```

**Problem:** Docker container won't start
```bash
# Check Docker logs
cd /var/www/projectes-{instance}/docker
docker compose logs

# Verify .env file
cat .env

# Check port conflicts
docker ps -a
sudo netstat -tulpn | grep :{port}

# Recreate container
docker compose down
docker compose up -d --force-recreate
```

**Problem:** Nginx configuration error
```bash
# Test nginx config
sudo nginx -t

# Check specific config
sudo cat /etc/nginx/sites-available/projectes-{instance}

# Fix and reload
sudo nano /etc/nginx/sites-available/projectes-{instance}
sudo nginx -t
sudo service nginx reload
```

**Problem:** SSL certificate failed
```bash
# Check DNS first
dig +short newclient.esstrapis.org

# Try certbot manually
sudo certbot --nginx -d newclient.esstrapis.org

# Check certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Verify nginx is serving HTTP (required for certbot)
curl -I http://newclient.esstrapis.org
```

### PM2 Management

```bash
# List all instances
pm2 list

# View logs
pm2 logs strapi-projectes-{instance}
pm2 logs strapi-projectes-{instance} --lines 100

# Restart instance
pm2 restart strapi-projectes-{instance}

# Stop instance
pm2 stop strapi-projectes-{instance}

# Delete instance (remove from PM2)
pm2 delete strapi-projectes-{instance}
pm2 save

# Reload all from configs
pm2 delete all
pm2 start ~/pm2-apps/*.config.js
pm2 save
```

### Docker Management

```bash
# Check container status
docker ps | grep esstrapis

# View logs
cd /var/www/projectes-{instance}/docker
docker compose logs -f

# Restart container
docker compose restart

# Rebuild and restart
docker compose down
docker compose pull
docker compose up -d --force-recreate

# Check container details
docker inspect {container_id}
```

## Backup Strategy

### Database Backups

Add to your backup script (`backups/backups.sh`):
```bash
mysqldump -u {instance} -p{password} {database} --no-tablespaces > /backups/{instance}_$(date +%Y%m%d).sql
```

### File Backups

```bash
# Backup instance directory
tar -czf /backups/projectes-{instance}_$(date +%Y%m%d).tar.gz /var/www/projectes-{instance}

# Backup PM2 config
cp ~/pm2-apps/strapi-projectes-{instance}.config.js /backups/
```

### Full Instance Backup

```bash
#!/bin/bash
INSTANCE="newclient"
BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Database
mysqldump -u $INSTANCE -p $INSTANCE --no-tablespaces > "$BACKUP_DIR/${INSTANCE}_db.sql"

# Files
tar -czf "$BACKUP_DIR/${INSTANCE}_files.tar.gz" /var/www/projectes-$INSTANCE

# Configs
cp ~/pm2-apps/strapi-projectes-$INSTANCE.config.js "$BACKUP_DIR/"
cp /etc/nginx/sites-available/projectes-$INSTANCE "$BACKUP_DIR/"
```

## Instance Removal

To remove an instance (not currently automated):

```bash
INSTANCE="oldclient"

# 1. Stop services
pm2 stop strapi-projectes-$INSTANCE
pm2 delete strapi-projectes-$INSTANCE
pm2 save

cd /var/www/projectes-$INSTANCE/docker
docker compose down

# 2. Remove nginx config
sudo rm /etc/nginx/sites-enabled/projectes-$INSTANCE
sudo rm /etc/nginx/sites-available/projectes-$INSTANCE
sudo nginx -t && sudo service nginx reload

# 3. Remove SSL certificate
sudo certbot delete --cert-name $INSTANCE.esstrapis.org

# 4. Drop database
sudo mysql -e "DROP DATABASE $INSTANCE; DROP USER '$INSTANCE'@'localhost';"

# 5. Remove files
sudo rm -rf /var/www/projectes-$INSTANCE
rm ~/pm2-apps/strapi-projectes-$INSTANCE.config.js

# 6. Update deploy scripts
# Remove line from deploy/deploy-projectes-back.sh
# Remove line from deploy/deploy-projectes-front.sh
```

## Best Practices

1. **Always create DNS first** - Verify with `dig` before running script
2. **Use dry-run mode** - Test with `--dry-run` before actual creation
3. **Keep buida clean** - Maintain `projectes-buida` as empty template
4. **Document customizations** - Note any per-instance changes in INSTANCE_INFO.md
5. **Test after creation** - Verify all URLs work before announcing to client
6. **Monitor logs** - Check PM2 and Docker logs for first 24 hours
7. **Regular backups** - Automate database and file backups
8. **Keep secrets secure** - INSTANCE_INFO.md has 600 permissions (owner only)

## Integration with Existing Workflows

### Deploy Scripts

The automation automatically updates:
- [deploy/deploy-projectes-back.sh](../deploy/deploy-projectes-back.sh)
- [deploy/deploy-projectes-front.sh](../deploy/deploy-projectes-front.sh)

After creating an instance, deploy scripts will include it:
```bash
cd /home/jordi/Documents/work/webcoop/projectes/deploy
./deploy-projectes-back.sh    # Will deploy to new instance
./deploy-projectes-front.sh   # Will deploy to new instance
```

### Manual Steps Still Required

1. **DNS subdomain creation** - Create in your DNS panel
2. **Backup script update** - Add mysqldump line to cron job
3. **Custom email config** - If instance needs different SMTP
4. **Data import** - If migrating existing data

## Security Considerations

- All secrets generated with `openssl rand -base64 32` (cryptographically secure)
- Database passwords are 24+ characters
- INSTANCE_INFO.md has restricted permissions (600)
- Never commit .env files or INSTANCE_INFO.md to git
- MySQL users use `mysql_native_password` for compatibility
- SSL certificates auto-renewed by certbot

## Performance Notes

- Backend npm install: ~2-5 minutes
- Backend build: ~1-3 minutes
- Docker image pull: ~1-2 minutes
- Database clone: ~10-30 seconds
- Total time: ~10-15 minutes per instance

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review log files in `/var/log/esstrapis-deploy/`
3. Check PM2 logs: `pm2 logs`
4. Check Docker logs: `docker compose logs`
5. Verify manual steps in [new-site/new-site.txt](../new-site/new-site.txt)

## License

Internal tool for webcoop ESSTRAPIS deployment.
