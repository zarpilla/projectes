#!/bin/bash

# ESSTRAPIS Database Migration Script
# Copies database from one instance to another with domain replacement
#
# Usage: ./migrate-database.sh --source <source> --target <target>

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Show usage
usage() {
    cat << EOF
ESSTRAPIS Database Migration Script

Usage: $0 --source <source> --target <target> [OPTIONS]

Required:
  --source <name>            Source instance name (e.g., buida, demo)
  --target <name>            Target instance name (e.g., newclient)

Options:
  --source-domain <domain>   Source domain (auto-detected if not provided)
  --target-domain <domain>   Target domain (auto-detected if not provided)
  --dry-run                  Show what would be done without executing
  -h, --help                 Show this help message

Examples:
  # Copy from buida to newclient (domains auto-detected)
  $0 --source buida --target newclient

  # Copy with explicit domains
  $0 --source demo --target production \\
     --source-domain demo.esstrapis.org \\
     --target-domain production.example.com

  # Dry-run to see what would happen
  $0 --source buida --target test --dry-run

WARNING: This will OVERWRITE the target database!

EOF
    exit 0
}

# Parse arguments
SOURCE_INSTANCE=""
TARGET_INSTANCE=""
SOURCE_DOMAIN=""
TARGET_DOMAIN=""
DRY_RUN=false
MYSQL_ADMIN_USER="admin"
MYSQL_ADMIN_PASS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --source)
            SOURCE_INSTANCE="$2"
            shift 2
            ;;
        --target)
            TARGET_INSTANCE="$2"
            shift 2
            ;;
        --source-domain)
            SOURCE_DOMAIN="$2"
            shift 2
            ;;
        --target-domain)
            TARGET_DOMAIN="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required arguments
if [ -z "$SOURCE_INSTANCE" ]; then
    error "Source instance is required (--source)"
    usage
fi

if [ -z "$TARGET_INSTANCE" ]; then
    error "Target instance is required (--target)"
    usage
fi

# Check if running as webcoop user
if [ "$USER" != "webcoop" ] && [ "$DRY_RUN" = false ]; then
    error "This script must be run as the webcoop user"
    exit 1
fi

# Banner
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ESSTRAPIS Database Migration${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
info "Source: $SOURCE_INSTANCE"
info "Target: $TARGET_INSTANCE"
if [ "$DRY_RUN" = true ]; then
    warning "DRY-RUN MODE - No changes will be made"
fi
echo ""

# Auto-detect domains from PM2 configs if not provided
if [ -z "$SOURCE_DOMAIN" ]; then
    SOURCE_PM2_CONFIG="$HOME/pm2-apps/strapi-projectes-$SOURCE_INSTANCE.config.js"
    if [ -f "$SOURCE_PM2_CONFIG" ]; then
        SOURCE_DOMAIN=$(grep "URL:" "$SOURCE_PM2_CONFIG" | cut -d"'" -f2 | sed 's|https://||' | sed 's|http://||')
        info "Auto-detected source domain: $SOURCE_DOMAIN"
    else
        # Fallback: assume esstrapis.org
        SOURCE_DOMAIN="$SOURCE_INSTANCE.esstrapis.org"
        warning "Could not find PM2 config, assuming domain: $SOURCE_DOMAIN"
    fi
fi

if [ -z "$TARGET_DOMAIN" ]; then
    TARGET_PM2_CONFIG="$HOME/pm2-apps/strapi-projectes-$TARGET_INSTANCE.config.js"
    if [ -f "$TARGET_PM2_CONFIG" ]; then
        TARGET_DOMAIN=$(grep "URL:" "$TARGET_PM2_CONFIG" | cut -d"'" -f2 | sed 's|https://||' | sed 's|http://||')
        info "Auto-detected target domain: $TARGET_DOMAIN"
    else
        # Fallback: assume esstrapis.org
        TARGET_DOMAIN="$TARGET_INSTANCE.esstrapis.org"
        warning "Could not find PM2 config, assuming domain: $TARGET_DOMAIN"
    fi
fi

echo ""
info "Source domain: $SOURCE_DOMAIN"
info "Target domain: $TARGET_DOMAIN"
echo ""

# Confirm action
if [ "$DRY_RUN" = false ]; then
    warning "This will OVERWRITE the target database: $TARGET_INSTANCE"
    warning "Current data in $TARGET_INSTANCE will be LOST!"
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm
    if [ "$confirm" != "yes" ]; then
        info "Migration cancelled"
        exit 0
    fi
    echo ""
    
    # Ask for MySQL admin password
    read -sp "Enter MySQL admin password: " MYSQL_ADMIN_PASS
    echo ""
    echo ""
fi

# Temporary files
BACKUP_FILE="/tmp/db_migration_${SOURCE_INSTANCE}_to_${TARGET_INSTANCE}_$(date +%Y%m%d_%H%M%S).sql"
REPLACE_SCRIPT="/tmp/replace_domains_${TARGET_INSTANCE}_$(date +%Y%m%d_%H%M%S).sql"

# ============================================
# Step 1: Backup source database
# ============================================
info "Step 1: Backing up source database ($SOURCE_INSTANCE)..."

if [ "$DRY_RUN" = false ]; then
    sudo mysqldump -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" "$SOURCE_INSTANCE" --no-tablespaces > "$BACKUP_FILE"
    
    # Check if backup succeeded
    if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        success "Database backed up: $BACKUP_FILE ($BACKUP_SIZE)"
    else
        error "Backup failed!"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would backup $SOURCE_INSTANCE to $BACKUP_FILE"
fi

echo ""

# ============================================
# Step 2: Restore to target database
# ============================================
info "Step 2: Restoring backup to target database ($TARGET_INSTANCE)..."

if [ "$DRY_RUN" = false ]; then
    # Check if target database exists
    if ! sudo mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" -e "USE $TARGET_INSTANCE" 2>/dev/null; then
        error "Target database '$TARGET_INSTANCE' does not exist!"
        error "Please create the instance first using create-instance.sh"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
    
    # Drop all tables in target database first
    sudo mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" "$TARGET_INSTANCE" <<EOF
SET FOREIGN_KEY_CHECKS = 0;
$(sudo mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" -Nse "SELECT CONCAT('DROP TABLE IF EXISTS \`', table_name, '\`;') FROM information_schema.tables WHERE table_schema='$TARGET_INSTANCE'")
SET FOREIGN_KEY_CHECKS = 1;
EOF
    
    # Import backup
    sudo mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" "$TARGET_INSTANCE" < "$BACKUP_FILE"
    success "Database restored to $TARGET_INSTANCE"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would restore backup to $TARGET_INSTANCE"
fi

echo ""

# ============================================
# Step 3: Replace domain references
# ============================================
info "Step 3: Replacing domain references ($SOURCE_DOMAIN → $TARGET_DOMAIN)..."

if [ "$DRY_RUN" = false ]; then
    # Generate UPDATE statements for all text columns
    sudo mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" -N -B "$TARGET_INSTANCE" <<EOF > "$REPLACE_SCRIPT"
SELECT CONCAT('UPDATE \`', table_name, '\` SET \`', column_name, '\` = REPLACE(\`', column_name, '\`, ''$SOURCE_DOMAIN'', ''$TARGET_DOMAIN'') WHERE \`', column_name, '\` LIKE ''%$SOURCE_DOMAIN%'';')
FROM information_schema.columns
WHERE table_schema = '$TARGET_INSTANCE'
  AND data_type IN ('varchar', 'text', 'mediumtext', 'longtext', 'char')
  AND table_name NOT LIKE 'strapi_%';
EOF
    
    # Execute the replacements
    if [ -s "$REPLACE_SCRIPT" ]; then
        REPLACE_COUNT=$(wc -l < "$REPLACE_SCRIPT")
        info "Found $REPLACE_COUNT columns to update..."
        
        sudo mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" "$TARGET_INSTANCE" < "$REPLACE_SCRIPT"
        success "Domain references replaced (${SOURCE_DOMAIN} → ${TARGET_DOMAIN})"
    else
        warning "No text columns found to update (this may be normal for empty databases)"
    fi
    
    # Clean up temporary files
    rm -f "$REPLACE_SCRIPT"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would replace $SOURCE_DOMAIN with $TARGET_DOMAIN in all text columns"
fi

echo ""

# ============================================
# Step 4: Restart target instance
# ============================================
info "Step 4: Restarting target instance..."

if [ "$DRY_RUN" = false ]; then
    # Restart PM2 process if it exists
    if pm2 list | grep -q "strapi-projectes-$TARGET_INSTANCE"; then
        pm2 restart "strapi-projectes-$TARGET_INSTANCE"
        success "PM2 process restarted: strapi-projectes-$TARGET_INSTANCE"
    else
        warning "PM2 process not found (may need manual start)"
    fi
    
    # Clean up backup file
    info "Cleaning up temporary files..."
    rm -f "$BACKUP_FILE"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would restart strapi-projectes-$TARGET_INSTANCE"
    echo -e "${YELLOW}[DRY-RUN]${NC} Would clean up: $BACKUP_FILE"
fi

echo ""

# ============================================
# Summary
# ============================================
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Migration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
success "Database migrated: $SOURCE_INSTANCE → $TARGET_INSTANCE"
success "Domain replaced: $SOURCE_DOMAIN → $TARGET_DOMAIN"
echo ""
info "Next steps:"
echo "  1. Verify target: https://$TARGET_DOMAIN/admin"
echo "  2. Check PM2 logs: pm2 logs strapi-projectes-$TARGET_INSTANCE"
echo "  3. Test frontend: https://$TARGET_DOMAIN/stats/"
echo ""
if [ "$DRY_RUN" = false ]; then
    info "Note: You may need to clear Strapi's cache or restart services"
fi
echo ""
