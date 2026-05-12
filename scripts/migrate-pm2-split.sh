#!/bin/bash

# ESSTRAPIS PM2 Migration Script
# Migrates monolithic ecosystem.config.js to split per-instance config files
# Run this once as webcoop user before using the instance creation automation

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}ESSTRAPIS PM2 Migration Script${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""

# Configuration
PM2_APPS_DIR="$HOME/pm2-apps"
ECOSYSTEM_FILE="$HOME/ecosystem.config.js"
BACKUP_FILE="$HOME/ecosystem.config.js.backup.$(date +%Y%m%d_%H%M%S)"

# Check if running as webcoop user
if [ "$USER" != "webcoop" ]; then
    echo -e "${YELLOW}Warning: This script should be run as the 'webcoop' user${NC}"
    read -p "Continue anyway? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if ecosystem.config.js exists
if [ ! -f "$ECOSYSTEM_FILE" ]; then
    echo -e "${RED}Error: $ECOSYSTEM_FILE not found${NC}"
    echo "Please ensure you have the monolithic ecosystem.config.js in your home directory"
    exit 1
fi

# Backup existing ecosystem.config.js
echo -e "${YELLOW}1. Backing up current ecosystem.config.js...${NC}"
cp "$ECOSYSTEM_FILE" "$BACKUP_FILE"
echo -e "${GREEN}   Backup created: $BACKUP_FILE${NC}"

# Create pm2-apps directory
echo -e "${YELLOW}2. Creating $PM2_APPS_DIR directory...${NC}"
mkdir -p "$PM2_APPS_DIR"

# List current PM2 processes
echo -e "${YELLOW}3. Current PM2 processes:${NC}"
pm2 list

echo ""
read -p "Ready to stop all PM2 processes and migrate? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Migration cancelled"
    exit 0
fi

# Stop all PM2 processes
echo -e "${YELLOW}4. Stopping all PM2 processes...${NC}"
pm2 stop all || true  # Continue even if some processes fail to stop

# Extract individual app configs from ecosystem.config.js
echo -e "${YELLOW}5. Splitting ecosystem.config.js into individual files...${NC}"

# Use Node.js to parse and split the config file
node <<'EOF'
const fs = require('fs');
const path = require('path');

// Load the ecosystem config
const ecosystemPath = process.env.HOME + '/ecosystem.config.js';
const config = require(ecosystemPath);

const appsDir = process.env.HOME + '/pm2-apps';

// Create individual config files for each app
config.apps.forEach(app => {
    const filename = `${app.name}.config.js`;
    const filepath = path.join(appsDir, filename);
    
    const individualConfig = {
        apps: [app]
    };
    
    const content = `module.exports = ${JSON.stringify(individualConfig, null, 2)};\n`;
    
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`   Created: ${filename}`);
});

console.log(`\n   Total: ${config.apps.length} config files created`);
EOF

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to split config files${NC}"
    echo "Restoring backup and restarting PM2..."
    cp "$BACKUP_FILE" "$ECOSYSTEM_FILE"
    pm2 restart all
    exit 1
fi

# Delete all PM2 processes from old config
echo -e "${YELLOW}6. Removing old PM2 configuration...${NC}"
pm2 delete all 2>/dev/null || true  # Suppress errors if already deleted
pm2 save --force 2>/dev/null || true

# Load all new individual configs
echo -e "${YELLOW}7. Loading new individual PM2 configs...${NC}"
for config_file in "$PM2_APPS_DIR"/*.config.js; do
    if [ -f "$config_file" ]; then
        app_name=$(basename "$config_file" .config.js)
        echo "   Starting: $app_name"
        pm2 start "$config_file"
    fi
done

# Save new PM2 configuration
echo -e "${YELLOW}8. Saving PM2 configuration...${NC}"
pm2 save

# Verify all processes are running
echo ""
echo -e "${YELLOW}9. Verifying PM2 processes:${NC}"

# Give PM2 a moment to stabilize
sleep 2

pm2 list

# Count running processes (without jq dependency)
running_count=$(pm2 list | grep -c "online" || echo "0")
total_count=$(ls -1 "$PM2_APPS_DIR"/*.config.js 2>/dev/null | wc -l)

echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Migration Complete!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo "PM2 processes with 'online' status: $running_count"
echo "Total config files created: $total_count"
echo ""
echo "Individual config files created in: $PM2_APPS_DIR"
echo "Backup of old config: $BACKUP_FILE"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify all instances are running: pm2 list"
echo "2. Check logs if needed: pm2 logs [app-name]"
echo "3. Keep the backup file for reference"
echo "4. You can now use the create-instance.sh script for new instances"
echo ""

if [ "$running_count" -lt "$total_count" ]; then
    echo -e "${YELLOW}Note: Some processes may still be starting up.${NC}"
    echo "Run 'pm2 list' in a few seconds to verify all are online."
else
    echo -e "${GREEN}Migration completed successfully!${NC}"
fi
