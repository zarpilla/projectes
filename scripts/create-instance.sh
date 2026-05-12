#!/bin/bash

# ESSTRAPIS Instance Creation Automation Script
# Creates a new ESSTRAPIS instance with database, backend, frontend, nginx, SSL
# 
# Usage: ./create-instance.sh [OPTIONS]
#   -n, --name <name>          Instance name (required)
#   -d, --domain <domain>      Full domain (e.g., example.esstrapis.org) (required)
#   -t, --template <name>      Template instance to clone from (default: buida)
#   --dry-run                  Show what would be done without executing
#   -h, --help                 Show this help message

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default configuration
BASE_DIR="/var/www"
TEMPLATE_INSTANCE="buida"
DRY_RUN=false
START_PHASE=1  # Start from phase 1 by default
MYSQL_ADMIN_USER="admin"
MYSQL_ADMIN_PASS=""  # Will prompt if needed

# Email defaults
DEFAULT_EMAIL_FROM="hola@esstrapis.org"
DEFAULT_TASK_EMAIL_TO="*"
DEFAULT_SMTP_HOST="smtp.esstrapis.com"
DEFAULT_SMTP_PORT="465"
DEFAULT_SMTP_USER="hola@esstrapis.org"
DEFAULT_SMTP_PASS=""  # Will prompt or use default

# Source utility functions
source "$SCRIPT_DIR/lib/generate-secrets.sh"
source "$SCRIPT_DIR/lib/port-scanner.sh"

# Logging
LOG_DIR="/var/log/esstrapis-deploy"
LOG_FILE=""

# Function to print colored messages
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Function to log commands
log_cmd() {
    if [ -n "$LOG_FILE" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    fi
}

# Function to execute command (respects dry-run)
execute() {
    local cmd="$1"
    log_cmd "$cmd"
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} $cmd"
    else
        eval "$cmd"
    fi
}

# Function to check if a phase should run
should_run_phase() {
    local phase_num=$1
    if [ "$phase_num" -ge "$START_PHASE" ]; then
        return 0  # Run this phase
    else
        return 1  # Skip this phase
    fi
}

# Show usage
usage() {
    cat << EOF
ESSTRAPIS Instance Creation Script

Usage: $0 [OPTIONS]

Options:
  -n, --name <name>          Instance name (required)
  -d, --domain <domain>      Full domain (e.g., example.esstrapis.org) (required)
  -t, --template <name>      Template instance to clone from (default: buida)
  --start-phase <number>     Start from specific phase (1-10, default: 1)
  --dry-run                  Show what would be done without executing
  -h, --help                 Show this help message

Phases:
  1: Validation              4: Database Setup        7: Frontend Config     10: Verification
  2: Generate Secrets        5: File Structure        8: Nginx & SSL
  3: Configuration           6: Backend Config        9: Integration

Examples:
  $0 --name newclient --domain newclient.esstrapis.org
  $0 -n test -d test.esstrapis.org --template demo --dry-run
  $0 -n test -d test.esstrapis.org --start-phase 6  # Resume from Phase 6

EOF
    exit 0
}

# Parse command line arguments
INSTANCE_NAME=""
DOMAIN=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            INSTANCE_NAME="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -t|--template)
            TEMPLATE_INSTANCE="$2"
            shift 2
            ;;
        --start-phase)
            START_PHASE="$2"
            if ! [[ "$START_PHASE" =~ ^[1-9]$|^10$ ]]; then
                error "Invalid phase number. Must be between 1 and 10."
                exit 1
            fi
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
if [ -z "$INSTANCE_NAME" ]; then
    error "Instance name is required (-n, --name)"
    usage
fi

if [ -z "$DOMAIN" ]; then
    error "Domain is required (-d, --domain)"
    usage
fi

# Initialize log file
if [ "$DRY_RUN" = false ]; then
    sudo mkdir -p "$LOG_DIR"
    sudo chown webcoop:webcoop "$LOG_DIR" 2>/dev/null || true
    LOG_FILE="$LOG_DIR/${INSTANCE_NAME}_$(date +%Y%m%d_%H%M%S).log"
    touch "$LOG_FILE"
fi

# Banner
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ESSTRAPIS Instance Creation${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
info "Instance: $INSTANCE_NAME"
info "Domain: $DOMAIN"
info "Template: $TEMPLATE_INSTANCE"
if [ "$START_PHASE" -gt 1 ]; then
    warning "Starting from Phase $START_PHASE (skipping phases 1-$((START_PHASE-1)))"
fi
if [ "$DRY_RUN" = true ]; then
    warning "DRY-RUN MODE - No changes will be made"
fi
echo ""

# Derived paths
INSTANCE_PATH="$BASE_DIR/projectes-$INSTANCE_NAME"
TEMPLATE_PATH="$BASE_DIR/projectes-$TEMPLATE_INSTANCE"
DB_NAME="$INSTANCE_NAME"
DB_USER="$INSTANCE_NAME"

# If starting from phase 2+, we need to discover ports even if Phase 1 is skipped
if [ "$START_PHASE" -gt 1 ]; then
    info "Discovering ports (required for later phases)..."
    BACKEND_PORT=$(find_next_backend_port)
    FRONTEND_PORT=$(find_next_frontend_port)
    if [ -z "$BACKEND_PORT" ] || [ -z "$FRONTEND_PORT" ]; then
        error "Failed to find available ports"
        exit 1
    fi
    info "Backend port: $BACKEND_PORT"
    info "Frontend port: $FRONTEND_PORT"
fi

# If starting from phase 3+, we need to generate secrets even if Phase 2 is skipped
if [ "$START_PHASE" -gt 2 ]; then
    info "Generating secrets (required for later phases)..."
    
    # Generate and explicitly export all secrets
    eval $(generate_all_secrets)
    export DB_PASSWORD APP_KEY_1 APP_KEY_2 APP_KEY_3 API_TOKEN_SALT ADMIN_JWT_SECRET TRANSFER_TOKEN_SALT JWT_SECRET
    
    info "Secrets generated and exported"
    
    # Debug: verify secrets were generated
    if [ -z "$APP_KEY_1" ] || [ -z "$JWT_SECRET" ]; then
        error "Failed to generate secrets!"
        exit 1
    fi
fi

# If starting from phase 4+, we need MySQL admin password
if [ "$START_PHASE" -gt 3 ] && [ "$DRY_RUN" = false ]; then
    read -sp "Enter MySQL admin password (required for phases 4+): " MYSQL_ADMIN_PASS
    echo ""
fi

if [ "$START_PHASE" -gt 1 ]; then
    echo ""
fi

# ============================================
# Phase 1: Validation
# ============================================
if should_run_phase 1; then
echo -e "${BLUE}=== Phase 1: Validation ===${NC}"

# Check if running as webcoop user
if [ "$USER" != "webcoop" ] && [ "$DRY_RUN" = false ]; then
    error "This script must be run as the webcoop user"
    exit 1
fi

# Check if instance already exists
if [ -d "$INSTANCE_PATH" ]; then
    error "Instance directory already exists: $INSTANCE_PATH"
    exit 1
fi

# Check if template exists
if [ ! -d "$TEMPLATE_PATH" ] && [ "$DRY_RUN" = false ]; then
    error "Template directory not found: $TEMPLATE_PATH"
    exit 1
fi
success "Template directory exists"

# Check if PM2 apps directory exists (should exist after migration)
if [ ! -d "$HOME/pm2-apps" ] && [ "$DRY_RUN" = false ]; then
    error "PM2 apps directory not found: $HOME/pm2-apps"
    error "Please run migrate-pm2-split.sh first"
    exit 1
fi
success "PM2 apps directory exists"

# Check DNS resolution
info "Checking DNS resolution for $DOMAIN..."
if command -v dig &> /dev/null; then
    if dig +short "$DOMAIN" | grep -q '[0-9]'; then
        success "DNS resolves for $DOMAIN"
    else
        warning "DNS does not resolve for $DOMAIN yet"
        warning "Make sure to create the subdomain before finalizing"
    fi
elif command -v nslookup &> /dev/null; then
    if nslookup "$DOMAIN" &> /dev/null; then
        success "DNS resolves for $DOMAIN"
    else
        warning "DNS does not resolve for $DOMAIN yet"
    fi
else
    warning "Cannot check DNS (dig/nslookup not available)"
fi

# Find available ports
info "Scanning for available ports..."
BACKEND_PORT=$(find_next_backend_port)
FRONTEND_PORT=$(find_next_frontend_port)
success "Backend port: $BACKEND_PORT"
success "Frontend port: $FRONTEND_PORT"

echo ""
fi  # End Phase 1

# ============================================
# Phase 2: Generate Secrets
# ============================================
if should_run_phase 2; then
echo -e "${BLUE}=== Phase 2: Generate Secrets ===${NC}"

info "Generating secure secrets..."

# Generate and explicitly export all secrets
eval $(generate_all_secrets)
export DB_PASSWORD APP_KEY_1 APP_KEY_2 APP_KEY_3 API_TOKEN_SALT ADMIN_JWT_SECRET TRANSFER_TOKEN_SALT JWT_SECRET

success "All secrets generated"

echo ""
fi  # End Phase 2

# ============================================
# Phase 3: Interactive Configuration
# ============================================
if should_run_phase 3; then
echo -e "${BLUE}=== Phase 3: Configuration ===${NC}"

# Ask for MySQL admin password
if [ "$DRY_RUN" = false ]; then
    read -sp "Enter MySQL admin password: " MYSQL_ADMIN_PASS
    echo ""
    
    # Ask for SMTP password (or use default)
    echo ""
    info "Email configuration (press Enter to use defaults)"
    read -p "SMTP Password [$DEFAULT_SMTP_USER]: " input_smtp_pass
    DEFAULT_SMTP_PASS="${input_smtp_pass:-$DEFAULT_SMTP_PASS}"
fi

echo ""
info "Configuration summary:"
echo "  DB Name: $DB_NAME"
echo "  DB User: $DB_USER"
echo "  Backend Port: $BACKEND_PORT"
echo "  Frontend Port: $FRONTEND_PORT"
echo "  Instance Path: $INSTANCE_PATH"
echo ""

if [ "$DRY_RUN" = false ]; then
    read -p "Proceed with instance creation? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        info "Instance creation cancelled"
        exit 0
    fi
fi

echo ""
fi  # End Phase 3

# ============================================
# Phase 4: Database Setup
# ============================================
if should_run_phase 4; then
echo -e "${BLUE}=== Phase 4: Database Setup ===${NC}"

info "Creating MySQL database and user..."

# Create SQL commands
SQL_COMMANDS="
CREATE USER '$DB_USER'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PASSWORD';
CREATE DATABASE $DB_NAME;
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
"

if [ "$DRY_RUN" = false ]; then
    echo "$SQL_COMMANDS" | sudo mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS"
    success "Database and user created"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would create database: $DB_NAME"
    echo -e "${YELLOW}[DRY-RUN]${NC} Would create user: $DB_USER"
fi

# Clone template database
info "Cloning database structure from $TEMPLATE_INSTANCE..."
if [ "$DRY_RUN" = false ]; then
    sudo mysqldump -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" "$TEMPLATE_INSTANCE" --no-tablespaces > "/tmp/${INSTANCE_NAME}_dump.sql"
    sudo mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" "$DB_NAME" < "/tmp/${INSTANCE_NAME}_dump.sql"
    rm "/tmp/${INSTANCE_NAME}_dump.sql"
    success "Database cloned from $TEMPLATE_INSTANCE"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would clone database structure"
fi

# Replace template domain with new domain in database
TEMPLATE_DOMAIN="${TEMPLATE_INSTANCE}.esstrapis.org"
info "Replacing $TEMPLATE_DOMAIN with $DOMAIN in database..."

if [ "$DRY_RUN" = false ]; then
    # Create a script to replace domain in all text columns
    REPLACE_SCRIPT="/tmp/replace_domain_${INSTANCE_NAME}.sql"
    
    # Get all tables and text columns, then generate UPDATE statements
    sudo mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" -N -B "$DB_NAME" <<EOF > "$REPLACE_SCRIPT"
SELECT CONCAT('UPDATE \`', table_name, '\` SET \`', column_name, '\` = REPLACE(\`', column_name, '\`, ''$TEMPLATE_DOMAIN'', ''$DOMAIN'') WHERE \`', column_name, '\` LIKE ''%$TEMPLATE_DOMAIN%'';')
FROM information_schema.columns
WHERE table_schema = '$DB_NAME'
  AND data_type IN ('varchar', 'text', 'mediumtext', 'longtext', 'char')
  AND table_name NOT LIKE 'strapi_%';
EOF
    
    # Execute the generated UPDATE statements
    if [ -s "$REPLACE_SCRIPT" ]; then
        sudo mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASS" "$DB_NAME" < "$REPLACE_SCRIPT"
        success "Domain replaced in database (${TEMPLATE_DOMAIN} → ${DOMAIN})"
    else
        warning "No text columns found to update (this may be normal for empty template)"
    fi
    
    rm -f "$REPLACE_SCRIPT"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would replace $TEMPLATE_DOMAIN with $DOMAIN in database"
fi

echo ""
fi  # End Phase 4

# ============================================
# Phase 5: File Structure
# ============================================
if should_run_phase 5; then
echo -e "${BLUE}=== Phase 5: File Structure ===${NC}"

info "Creating instance directory..."
execute "sudo mkdir -p '$INSTANCE_PATH'"
execute "sudo chown -R webcoop:webcoop '$INSTANCE_PATH'"
success "Instance directory created"

info "Copying template files..."
execute "sudo cp -r '$TEMPLATE_PATH'/* '$INSTANCE_PATH'/"
execute "sudo chown -R webcoop:webcoop '$INSTANCE_PATH'"
success "Template files copied"

info "Initializing git repositories..."
if [ "$DRY_RUN" = false ]; then
    # Update projectes directory if it's a git repo
    if [ -d "$INSTANCE_PATH/projectes/.git" ]; then
        cd "$INSTANCE_PATH/projectes" && git fetch --all && git reset --hard origin/master
        success "Git repository updated: projectes/"
    else
        warning "projectes/ is not a git repository, skipping git update"
    fi
    
    # Update docker directory if it's a git repo
    if [ -d "$INSTANCE_PATH/docker/.git" ]; then
        cd "$INSTANCE_PATH/docker" && git fetch --all && git reset --hard origin/master
        success "Git repository updated: docker/"
    else
        info "docker/ is not a git repository, skipping git update"
    fi
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would update git repositories (if they exist)"
fi

echo ""
fi  # End Phase 5

# ============================================
# Phase 6: Backend Configuration
# ============================================
if should_run_phase 6; then
echo -e "${BLUE}=== Phase 6: Backend Configuration ===${NC}"

info "Creating PM2 configuration..."

PM2_CONFIG_FILE="$HOME/pm2-apps/strapi-projectes-$INSTANCE_NAME.config.js"

# Generate PM2 config from template
if [ "$DRY_RUN" = false ]; then
    sed -e "s|{{INSTANCE_NAME}}|$INSTANCE_NAME|g" \
        -e "s|{{INSTANCE_PATH}}|$INSTANCE_PATH|g" \
        -e "s|{{BACKEND_PORT}}|$BACKEND_PORT|g" \
        -e "s|{{DOMAIN}}|$DOMAIN|g" \
        -e "s|{{DB_NAME}}|$DB_NAME|g" \
        -e "s|{{DB_USER}}|$DB_USER|g" \
        -e "s|{{DB_PASSWORD}}|$DB_PASSWORD|g" \
        -e "s|{{APP_KEY_1}}|$APP_KEY_1|g" \
        -e "s|{{APP_KEY_2}}|$APP_KEY_2|g" \
        -e "s|{{APP_KEY_3}}|$APP_KEY_3|g" \
        -e "s|{{API_TOKEN_SALT}}|$API_TOKEN_SALT|g" \
        -e "s|{{ADMIN_JWT_SECRET}}|$ADMIN_JWT_SECRET|g" \
        -e "s|{{TRANSFER_TOKEN_SALT}}|$TRANSFER_TOKEN_SALT|g" \
        -e "s|{{JWT_SECRET}}|$JWT_SECRET|g" \
        -e "s|{{EMAIL_FROM}}|$DEFAULT_EMAIL_FROM|g" \
        -e "s|{{TASK_EMAIL_TO}}|$DEFAULT_TASK_EMAIL_TO|g" \
        -e "s|{{SMTP_HOST}}|$DEFAULT_SMTP_HOST|g" \
        -e "s|{{SMTP_PORT}}|$DEFAULT_SMTP_PORT|g" \
        -e "s|{{SMTP_USER}}|$DEFAULT_SMTP_USER|g" \
        -e "s|{{SMTP_PASS}}|$DEFAULT_SMTP_PASS|g" \
        "$SCRIPT_DIR/templates/pm2-app.config.js.template" > "$PM2_CONFIG_FILE"
    
    success "PM2 config created: $PM2_CONFIG_FILE"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would create PM2 config at: $PM2_CONFIG_FILE"
fi

info "Installing backend dependencies and building..."
execute "cd '$INSTANCE_PATH/projectes' && npm i && NODE_ENV=production npm run build"
success "Backend built"

info "Starting PM2 process..."
execute "pm2 start '$PM2_CONFIG_FILE'"
execute "pm2 save"
success "PM2 process started"

echo ""
fi  # End Phase 6

# ============================================
# Phase 7: Frontend Docker Configuration
# ============================================
if should_run_phase 7; then
echo -e "${BLUE}=== Phase 7: Frontend Configuration ===${NC}"

info "Creating Docker .env file..."

DOCKER_ENV_FILE="$INSTANCE_PATH/docker/.env"

if [ "$DRY_RUN" = false ]; then
    cat > "$DOCKER_ENV_FILE" << EOF
VUE_APP_API_URL=https://$DOMAIN
VUE_APP_API_LOGIN=https://$DOMAIN/admin
VUE_APP_PATH=/stats/
VUE_APP_RESET_PASSWORD=https://$DOMAIN/stats/#/reset-password
EXTERNAL_PORT=$FRONTEND_PORT
EOF
    success "Docker .env created"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would create Docker .env at: $DOCKER_ENV_FILE"
fi

info "Updating docker-compose.yml service name..."
if [ "$DRY_RUN" = false ]; then
    # Replace template service name with instance-specific name
    sed -i "s/esstrapis-front-$TEMPLATE_INSTANCE/esstrapis-front-$INSTANCE_NAME/g" "$INSTANCE_PATH/docker/docker-compose.yml"
    success "Docker compose service name updated"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would update service name in docker-compose.yml"
fi

info "Starting Docker container..."
execute "cd '$INSTANCE_PATH/docker' && docker compose pull && docker compose up -d --force-recreate"
success "Docker container started"

echo ""
fi  # End Phase 7

# ============================================
# Phase 8: Nginx & SSL Configuration
# ============================================
if should_run_phase 8; then
echo -e "${BLUE}=== Phase 8: Nginx & SSL Configuration ===${NC}"

NGINX_CONFIG="/etc/nginx/sites-available/projectes-$INSTANCE_NAME"
NGINX_ENABLED="/etc/nginx/sites-enabled/projectes-$INSTANCE_NAME"

info "Creating nginx configuration..."

if [ "$DRY_RUN" = false ]; then
    sudo sed -e "s|{{DOMAIN}}|$DOMAIN|g" \
        -e "s|{{BACKEND_PORT}}|$BACKEND_PORT|g" \
        -e "s|{{FRONTEND_PORT}}|$FRONTEND_PORT|g" \
        -e "s|{{INSTANCE_PATH}}|$INSTANCE_PATH|g" \
        "$SCRIPT_DIR/templates/nginx-site.conf.template" | sudo tee "$NGINX_CONFIG" > /dev/null
    
    success "Nginx config created"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would create nginx config at: $NGINX_CONFIG"
fi

info "Enabling nginx site..."
execute "sudo ln -s '$NGINX_CONFIG' '$NGINX_ENABLED'"

info "Testing nginx configuration..."
execute "sudo nginx -t"

info "Restarting nginx..."
execute "sudo service nginx restart"
success "Nginx configured and restarted"

info "Requesting SSL certificate..."
if [ "$DRY_RUN" = false ]; then
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email hola@esstrapis.org || warning "SSL certificate request failed (check certbot logs)"
    success "SSL certificate configured"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would request SSL certificate for: $DOMAIN"
fi

echo ""
fi  # End Phase 8

# ============================================
# Phase 9: Integration & Documentation
# ============================================
if should_run_phase 9; then
echo -e "${BLUE}=== Phase 9: Integration & Documentation ===${NC}"

info "Updating deployment scripts..."

# Try to find deploy scripts in common locations
DEPLOY_BACK=""
DEPLOY_FRONT=""

# Check multiple possible locations (script dir first, then other common locations)
for dir in "$SCRIPT_DIR" "$SCRIPT_DIR/../deploy" "$HOME/deploy" "/home/webcoop/deploy"; do
    if [ -f "$dir/deploy-projectes-back.sh" ]; then
        DEPLOY_BACK="$dir/deploy-projectes-back.sh"
        DEPLOY_FRONT="$dir/deploy-projectes-front.sh"
        break
    fi
done

# Update deploy-projectes-back.sh
if [ -n "$DEPLOY_BACK" ] && [ -f "$DEPLOY_BACK" ]; then
    if [ "$DRY_RUN" = false ]; then
        # Add new instance to PROJECTS array (after the opening line)
        sudo sed -i "/^PROJECTS=(/a\\    \"$INSTANCE_NAME:$INSTANCE_PATH/projectes\"" "$DEPLOY_BACK"
        success "Updated deploy-projectes-back.sh"
    else
        echo -e "${YELLOW}[DRY-RUN]${NC} Would update deploy-projectes-back.sh"
    fi
else
    warning "deploy-projectes-back.sh not found (manually add to deployment scripts)"
fi

# Update deploy-projectes-front.sh
if [ -n "$DEPLOY_FRONT" ] && [ -f "$DEPLOY_FRONT" ]; then
    if [ "$DRY_RUN" = false ]; then
        sudo sed -i "/^PROJECTS=(/a\\    \"$INSTANCE_NAME:$INSTANCE_PATH/docker\"" "$DEPLOY_FRONT"
        success "Updated deploy-projectes-front.sh"
    else
        echo -e "${YELLOW}[DRY-RUN]${NC} Would update deploy-projectes-front.sh"
    fi
else
    warning "deploy-projectes-front.sh not found (manually add to deployment scripts)"
fi

info "Creating instance documentation..."

INSTANCE_INFO="$INSTANCE_PATH/INSTANCE_INFO.md"

if [ "$DRY_RUN" = false ]; then
    cat > "$INSTANCE_INFO" << EOF
# ESSTRAPIS Instance: $INSTANCE_NAME

**Created:** $(date)
**Domain:** https://$DOMAIN

## Configuration

### Ports
- Backend (PM2): $BACKEND_PORT
- Frontend (Docker): $FRONTEND_PORT

### Database
- Name: $DB_NAME
- User: $DB_USER
- Password: $DB_PASSWORD
- Host: 127.0.0.1:3306

### Strapi Secrets
- APP_KEYS: $APP_KEY_1,$APP_KEY_2,$APP_KEY_3
- API_TOKEN_SALT: $API_TOKEN_SALT
- ADMIN_JWT_SECRET: $ADMIN_JWT_SECRET
- TRANSFER_TOKEN_SALT: $TRANSFER_TOKEN_SALT
- JWT_SECRET: $JWT_SECRET

### Email Configuration
- Provider: nodemailer
- From: $DEFAULT_EMAIL_FROM
- SMTP Host: $DEFAULT_SMTP_HOST:$DEFAULT_SMTP_PORT
- SMTP User: $DEFAULT_SMTP_USER

## Paths

- Instance Root: $INSTANCE_PATH
- Backend: $INSTANCE_PATH/projectes
- Frontend: $INSTANCE_PATH/docker
- PM2 Config: $HOME/pm2-apps/strapi-projectes-$INSTANCE_NAME.config.js
- Nginx Config: /etc/nginx/sites-available/projectes-$INSTANCE_NAME

## Management Commands

### PM2 (Backend)
\`\`\`bash
pm2 logs strapi-projectes-$INSTANCE_NAME
pm2 restart strapi-projectes-$INSTANCE_NAME
pm2 stop strapi-projectes-$INSTANCE_NAME
\`\`\`

### Docker (Frontend)
\`\`\`bash
cd $INSTANCE_PATH/docker
docker compose logs -f
docker compose restart
docker compose down
docker compose up -d
\`\`\`

### Database
\`\`\`bash
mysql -u $DB_USER -p $DB_NAME
mysqldump -u $DB_USER -p $DB_NAME > backup.sql
\`\`\`

## URLs

- Frontend: https://$DOMAIN/stats/
- Admin Panel: https://$DOMAIN/admin
- API: https://$DOMAIN/api

## Notes

- Template cloned from: $TEMPLATE_INSTANCE
- Log file: $LOG_FILE
EOF

    chmod 600 "$INSTANCE_INFO"
    success "Instance documentation created: $INSTANCE_INFO"
else
    echo -e "${YELLOW}[DRY-RUN]${NC} Would create instance documentation"
fi

echo ""
fi  # End Phase 9

# ============================================
# Phase 10: Verification
# ============================================
if should_run_phase 10; then
echo -e "${BLUE}=== Phase 10: Verification ===${NC}"

if [ "$DRY_RUN" = false ]; then
    info "Verifying PM2 process..."
    if pm2 list | grep -q "strapi-projectes-$INSTANCE_NAME"; then
        success "PM2 process is running"
    else
        error "PM2 process not found!"
    fi
    
    info "Verifying Docker container..."
    if docker ps | grep -q "$INSTANCE_NAME"; then
        success "Docker container is running"
    else
        warning "Docker container not found (check logs)"
    fi
    
    info "Checking nginx configuration..."
    if sudo nginx -t &> /dev/null; then
        success "Nginx configuration is valid"
    else
        error "Nginx configuration has errors!"
    fi
fi

echo ""
fi  # End Phase 10

# ============================================
# Summary
# ============================================
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Instance Creation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
success "Instance: $INSTANCE_NAME"
success "Domain: https://$DOMAIN"
echo ""
info "Next steps:"
echo "  1. Verify frontend: https://$DOMAIN/stats/"
echo "  2. Access admin panel: https://$DOMAIN/admin"
echo "  3. Check PM2 logs: pm2 logs strapi-projectes-$INSTANCE_NAME"
echo "  4. Check Docker logs: cd $INSTANCE_PATH/docker && docker compose logs"
echo "  5. Review documentation: $INSTANCE_INFO"
echo ""
if [ -n "$LOG_FILE" ]; then
    info "Log file: $LOG_FILE"
fi
echo ""
success "All done! 🎉"
