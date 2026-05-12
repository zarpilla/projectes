#!/bin/bash

# Utility to generate cryptographically secure secrets for Strapi instances
# Usage: source this file and call generate_secret or generate_all_secrets

# Generate a single base64-encoded secret
generate_secret() {
    openssl rand -base64 32 | tr -d '\n'
}

# Generate a random password that meets MySQL password policy requirements
# MySQL requires: uppercase, lowercase, numbers, special chars, min 8 chars
generate_password() {
    local length="${1:-20}"
    
    # Generate components to ensure policy compliance
    local upper=$(tr -dc 'A-Z' < /dev/urandom | head -c 3)
    local lower=$(tr -dc 'a-z' < /dev/urandom | head -c 3)
    local digit=$(tr -dc '0-9' < /dev/urandom | head -c 3)
    local special=$(tr -dc '!@#$%^&*()-_=+' < /dev/urandom | head -c 2)
    
    # Combine and add random chars to reach desired length
    local remaining=$((length - 11))
    local random=$(tr -dc 'A-Za-z0-9!@#$%^&*()-_=+' < /dev/urandom | head -c "$remaining")
    
    # Combine all parts and shuffle
    echo "${upper}${lower}${digit}${special}${random}" | fold -w1 | shuf | tr -d '\n'
}

# Generate all required secrets for a Strapi instance
# Returns: associative array with all secrets
generate_all_secrets() {
    echo "DB_PASSWORD=$(generate_password 24)"
    echo "APP_KEY_1=$(generate_secret)"
    echo "APP_KEY_2=$(generate_secret)"
    echo "APP_KEY_3=$(generate_secret)"
    echo "API_TOKEN_SALT=$(generate_secret)"
    echo "ADMIN_JWT_SECRET=$(generate_secret)"
    echo "TRANSFER_TOKEN_SALT=$(generate_secret)"
    echo "JWT_SECRET=$(generate_secret)"
}

# Generate secrets and export as environment variables
export_secrets() {
    while IFS='=' read -r key value; do
        export "$key=$value"
    done < <(generate_all_secrets)
}

# If script is run directly (not sourced), generate and display secrets
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "# Generated secrets for ESSTRAPIS instance"
    echo "# Generated: $(date)"
    echo ""
    generate_all_secrets
fi
