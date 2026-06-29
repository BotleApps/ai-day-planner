#!/bin/bash

#######################################################
# AI Day Planner - Local Development Setup Script
#######################################################
#
# This script sets up and runs the AI Day Planner locally.
# It handles MongoDB setup (via Docker), environment configuration,
# and starts the Next.js development server.
#
#######################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emojis
CHECK="✅"
ROCKET="🚀"
DATABASE="🗄️"
GEAR="⚙️"
SPARKLES="✨"
WARNING="⚠️"
ERROR="❌"

print_banner() {
    echo ""
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}  ${SPARKLES}  ${CYAN}AI Day Planner${NC} - Local Development Setup  ${SPARKLES}       ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}$1${NC} $2"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}${CHECK} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}${WARNING} $1${NC}"
}

print_error() {
    echo -e "${RED}${ERROR} $1${NC}"
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_step "${GEAR}" "Checking prerequisites..."
    
    local missing=()
    
    if ! command_exists node; then
        missing+=("Node.js")
    else
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
    fi
    
    if ! command_exists npm; then
        missing+=("npm")
    else
        NPM_VERSION=$(npm --version)
        print_success "npm found: v$NPM_VERSION"
    fi
    
    if ! command_exists docker; then
        print_warning "Docker not found - MongoDB will need to be provided externally"
        DOCKER_AVAILABLE=false
    else
        DOCKER_VERSION=$(docker --version | cut -d ' ' -f 3 | tr -d ',')
        print_success "Docker found: v$DOCKER_VERSION"
        DOCKER_AVAILABLE=true
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing[*]}"
        echo ""
        echo "Please install the missing tools and try again:"
        echo "  - Node.js: https://nodejs.org/"
        echo "  - npm: Comes with Node.js"
        echo "  - Docker (optional): https://www.docker.com/"
        exit 1
    fi
    
    echo ""
}

# Setup environment file
setup_env() {
    print_step "${GEAR}" "Setting up environment..."
    
    if [ -f ".env.local" ]; then
        print_success ".env.local already exists"
        # Check if MONGODB_URI is set
        if grep -q "MONGODB_URI" .env.local; then
            print_success "MONGODB_URI is configured"
            return 0
        fi
    fi
    
    # Create or update .env.local
    if [ "$DOCKER_AVAILABLE" = true ]; then
        MONGODB_URI="mongodb://localhost:27017/ai-day-planner"
    else
        echo ""
        echo -e "${YELLOW}Please enter your MongoDB connection string:${NC}"
        echo -e "${CYAN}(e.g., mongodb://localhost:27017/ai-day-planner or MongoDB Atlas URL)${NC}"
        read -p "> " MONGODB_URI
        
        if [ -z "$MONGODB_URI" ]; then
            MONGODB_URI="mongodb://localhost:27017/ai-day-planner"
            print_warning "Using default: $MONGODB_URI"
        fi
    fi
    
    # Create .env.local file
    cat > .env.local << EOF
# MongoDB Connection String
# For local development with Docker, use: mongodb://localhost:27017/ai-day-planner
# For MongoDB Atlas, use your connection string from the Atlas dashboard
MONGODB_URI=$MONGODB_URI

# Node Environment
NODE_ENV=development
EOF
    
    print_success "Created .env.local with MongoDB configuration"
    echo ""
}

# Start MongoDB with Docker
start_mongodb() {
    if [ "$DOCKER_AVAILABLE" = false ]; then
        print_warning "Docker not available, skipping MongoDB container setup"
        return 0
    fi
    
    print_step "${DATABASE}" "Setting up MongoDB..."
    
    # Check if MongoDB container is already running
    if docker ps --format '{{.Names}}' | grep -q '^ai-day-planner-mongodb$'; then
        print_success "MongoDB container is already running"
        return 0
    fi
    
    # Check if container exists but is stopped
    if docker ps -a --format '{{.Names}}' | grep -q '^ai-day-planner-mongodb$'; then
        print_warning "MongoDB container exists but is stopped. Starting it..."
        docker start ai-day-planner-mongodb
        print_success "MongoDB container started"
        return 0
    fi
    
    # Pull and run MongoDB container
    echo "Starting new MongoDB container..."
    docker run -d \
        --name ai-day-planner-mongodb \
        -p 27017:27017 \
        -v ai-day-planner-mongodb-data:/data/db \
        mongo:7.0
    
    # Wait for MongoDB to be ready
    echo "Waiting for MongoDB to be ready..."
    sleep 3
    
    # Check if MongoDB is responding
    local max_attempts=30
    local attempt=1
    while [ $attempt -le $max_attempts ]; do
        if docker exec ai-day-planner-mongodb mongosh --eval "db.runCommand('ping').ok" --quiet 2>/dev/null | grep -q '1'; then
            print_success "MongoDB is ready!"
            break
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_error "MongoDB failed to start in time"
        exit 1
    fi
    
    echo ""
}

# Install dependencies
install_dependencies() {
    print_step "${GEAR}" "Installing dependencies..."
    
    if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
        print_success "node_modules exists, running npm ci for faster install..."
        npm ci --silent
    else
        npm install --silent
    fi
    
    print_success "Dependencies installed"
    echo ""
}

# Run type check
run_type_check() {
    print_step "${GEAR}" "Running TypeScript type check..."
    
    if npm run type-check 2>/dev/null; then
        print_success "No TypeScript errors found"
    else
        print_warning "TypeScript check found some issues (continuing anyway)"
    fi
    
    echo ""
}

# Start the development server
start_dev_server() {
    print_step "${ROCKET}" "Starting development server..."
    
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}  ${SPARKLES} ${CYAN}AI Day Planner is ready!${NC} ${SPARKLES}                          ${GREEN}║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BLUE}Local:${NC}        http://localhost:3000                    ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${BLUE}Network:${NC}      Check terminal output below              ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${YELLOW}Press Ctrl+C to stop the server${NC}                        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                          ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Start Next.js dev server
    npm run dev
}

# Cleanup function
cleanup() {
    echo ""
    print_warning "Shutting down..."
    
    if [ "$DOCKER_AVAILABLE" = true ]; then
        read -p "Stop MongoDB container? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker stop ai-day-planner-mongodb 2>/dev/null || true
            print_success "MongoDB container stopped"
        else
            print_success "MongoDB container left running for future use"
        fi
    fi
    
    echo ""
    echo -e "${PURPLE}Thanks for using AI Day Planner! ${SPARKLES}${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    print_banner
    check_prerequisites
    setup_env
    start_mongodb
    install_dependencies
    run_type_check
    start_dev_server
}

# Run with optional flags
case "${1:-}" in
    --help|-h)
        echo "Usage: ./run-local.sh [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --no-docker    Skip Docker/MongoDB setup"
        echo "  --clean        Clean install (removes node_modules)"
        echo ""
        exit 0
        ;;
    --no-docker)
        DOCKER_AVAILABLE=false
        main
        ;;
    --clean)
        echo "Cleaning up..."
        rm -rf node_modules .next
        main
        ;;
    *)
        main
        ;;
esac
