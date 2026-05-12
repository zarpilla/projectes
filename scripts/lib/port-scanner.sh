#!/bin/bash

# Utility to find available ports for new ESSTRAPIS instances
# Usage: source this file and call find_next_backend_port or find_next_frontend_port

# Find next available backend port (starting from 1337)
find_next_backend_port() {
    local start_port=1337
    local end_port=1400
    
    for port in $(seq $start_port $end_port); do
        if ! port_in_use "$port"; then
            echo "$port"
            return 0
        fi
    done
    
    echo "ERROR: No available backend ports in range $start_port-$end_port" >&2
    return 1
}

# Find next available frontend port (starting from 8000)
find_next_frontend_port() {
    local start_port=8000
    local end_port=9000
    
    for port in $(seq $start_port $end_port); do
        if ! port_in_use "$port"; then
            echo "$port"
            return 0
        fi
    done
    
    echo "ERROR: No available frontend ports in range $start_port-$end_port" >&2
    return 1
}

# Check if a port is in use
port_in_use() {
    local port=$1
    
    # Check with netstat (if available)
    if command -v netstat &> /dev/null; then
        netstat -tuln 2>/dev/null | grep -q ":$port "
        return $?
    fi
    
    # Check with ss (modern alternative)
    if command -v ss &> /dev/null; then
        ss -tuln 2>/dev/null | grep -q ":$port "
        return $?
    fi
    
    # Check with lsof (if available)
    if command -v lsof &> /dev/null; then
        lsof -i ":$port" &> /dev/null
        return $?
    fi
    
    # Fallback: check if PM2 config mentions this port
    if [ -d "$HOME/pm2-apps" ]; then
        grep -rq "PORT.*:.*'$port'" "$HOME/pm2-apps/" 2>/dev/null
        return $?
    fi
    
    # If no tools available, assume port is free (not ideal but safe)
    return 1
}

# List all ports currently in use by ESSTRAPIS instances
list_used_ports() {
    echo "=== Backend Ports (PM2) ==="
    if [ -d "$HOME/pm2-apps" ]; then
        grep -rh "PORT.*:" "$HOME/pm2-apps/" 2>/dev/null | grep -o "[0-9]\{4,5\}" | sort -n | uniq
    fi
    
    echo ""
    echo "=== Frontend Ports (Docker) ==="
    if command -v docker &> /dev/null; then
        docker ps --format "{{.Names}}\t{{.Ports}}" | grep esstrapis-front | grep -o "0.0.0.0:[0-9]*" | cut -d: -f2 | sort -n
    fi
}

# If script is run directly (not sourced), show available ports
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "=== Port Scanner for ESSTRAPIS ===" 
    echo ""
    
    echo "Currently used ports:"
    list_used_ports
    echo ""
    
    backend_port=$(find_next_backend_port)
    frontend_port=$(find_next_frontend_port)
    
    echo "Next available ports:"
    echo "  Backend:  $backend_port"
    echo "  Frontend: $frontend_port"
fi
