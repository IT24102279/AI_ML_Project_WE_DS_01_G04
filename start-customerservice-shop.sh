#!/bin/bash

# Define paths
BACKEND_DIR="backend_customer"
FRONTEND_DIR="frontend_customer"

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Customer Service & Shop Microservices...${NC}"

# Ensure Node modules are installed
echo -e "${BLUE}▶ Checking Backend Dependencies...${NC}"
cd $BACKEND_DIR
if [ ! -d "node_modules" ]; then
    /tmp/fnm/fnm exec --using=20 npm install
fi

echo -e "${YELLOW}▶ Setting up isolated Customer Database Schema...${NC}"
mysql -h 127.0.0.1 -u root -proot pharmacy_customer_db < src/schema.sql 2>/dev/null || echo -e "  (Schema already exists or was seeded)"

# Start Backend using fnm node 20
echo -e "${BLUE}▶ Starting Node.js Backend Server on Port 4000...${NC}"
/tmp/fnm/fnm exec --using=20 npx --yes tsx src/index.ts &
BACKEND_PID=$!
cd ..

# Wait a couple seconds to ensure backend is up
sleep 2

# Ensure Node modules are installed
echo -e "${BLUE}▶ Checking Frontend Dependencies...${NC}"
cd $FRONTEND_DIR
if [ ! -d "node_modules" ]; then
    /tmp/fnm/fnm exec --using=20 npm install
fi

# Start Frontend using fnm node 20
echo -e "${BLUE}▶ Starting React Vite Frontend Server on Port 5174...${NC}"
/tmp/fnm/fnm exec --using=20 npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}Both servers are running!${NC}"
echo -e "Backend: http://localhost:4000"
echo -e "Frontend: http://localhost:5174"
echo -e "Press [CTRL+C] to stop both servers."

# Trap CTRL+C to kill both background processes
trap "echo 'Stopping servers...'; kill $BACKEND_PID; kill $FRONTEND_PID; exit" SIGINT

# Wait for background processes to keep the script running
wait
