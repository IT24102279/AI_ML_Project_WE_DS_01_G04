#!/bin/bash
# setup.sh
# Full Application Setup Script for AI Pharmacy POS (Bash/Linux/WSL)

# Colors for output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}============================${NC}"
echo -e "${CYAN}   AI Pharmacy POS Setup    ${NC}"
echo -e "${CYAN}============================${NC}"

# 1. Ensure .env files exist
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}▶ Creating default .env for backend...${NC}"
    echo "DATABASE_URL=mysql://root:root@127.0.0.1:3306/pharmacy_pos" > backend/.env
    echo "PORT=5000" >> backend/.env
fi

if [ ! -f "backend_customer/.env" ]; then
    echo -e "${YELLOW}▶ Creating default .env for backend_customer...${NC}"
    echo "PORT=4000" > backend_customer/.env
    echo "DB_HOST=127.0.0.1" >> backend_customer/.env
    echo "DB_PORT=3306" >> backend_customer/.env
    echo "DB_USER=root" >> backend_customer/.env
    echo "DB_PASSWORD=root" >> backend_customer/.env
    echo "DB_NAME=pharmacy_customer_db" >> backend_customer/.env
fi

# 2. Extract Credentials & Create Databases
echo -e "\n${GREEN}[1/3] Setting up Databases...${NC}"

# Function to get env value
get_env_val() {
    grep "^$2=" "$1" | cut -d'=' -f2- | tr -d '\r'
}

# Extract credentials
DB_URL=$(get_env_val "backend/.env" "DATABASE_URL")
# mysql://root:root@127.0.0.1:3306/pharmacy_pos
DB_USER_MAIN=$(echo $DB_URL | sed -e 's/mysql:\/\/\([^:]*\):.*/\1/')
DB_PASS_MAIN=$(echo $DB_URL | sed -e 's/mysql:\/\/.*:\([^@]*\)@.*/\1/')
DB_NAME_MAIN=$(echo $DB_URL | sed -r 's/.*\/([^?]+).*/\1/')

DB_NAME_CUST=$(get_env_val "backend_customer/.env" "DB_NAME")
DB_USER_CUST=$(get_env_val "backend_customer/.env" "DB_USER")
DB_PASS_CUST=$(get_env_val "backend_customer/.env" "DB_PASSWORD")

echo -e "  Extracted DB Main: ${DB_NAME_MAIN}"
echo -e "  Extracted DB Cust: ${DB_NAME_CUST}"

# Create Databases
if command -v mysql &> /dev/null; then
    echo -e "  Creating databases via MySQL CLI..."
    
    # Create Main DB
    mysql -u "$DB_USER_MAIN" -p"$DB_PASS_MAIN" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME_MAIN;" 2>/dev/null
    # Create Customer DB
    mysql -u "$DB_USER_CUST" -p"$DB_PASS_CUST" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME_CUST;" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✔ Databases ensured successfully.${NC}"
    else
        echo -e "  ${YELLOW}⚠ Database creation failed. Check MySQL status or credentials.${NC}"
    fi
else
    echo -e "  ${RED}⚠ 'mysql' command not found. Please create databases manually: $DB_NAME_MAIN, $DB_NAME_CUST${NC}"
fi

# 3. NPM Installs
echo -e "\n${GREEN}[2/3] Installing Node.js dependencies...${NC}"
for dir in backend frontend backend_customer frontend_customer; do
    if [ -d "$dir" ]; then
        echo -e "  ${CYAN}▶ Processing $dir...${NC}"
        (cd "$dir" && npm install)
    fi
done

# 4. Python Installs
echo -e "\n${GREEN}[3/3] Installing Python dependencies for AI OCR Model...${NC}"
if [ -d "ai_OCR_Model" ]; then
    cd ai_OCR_Model
    PYTHON_CMD="python3"
    if ! command -v python3 &> /dev/null; then
        PYTHON_CMD="python"
    fi
    echo -e "  Using $PYTHON_CMD to install requirements..."
    $PYTHON_CMD -m pip install -r requirements.txt
    cd ..
fi

echo -e "\n${GREEN}============================${NC}"
echo -e "${GREEN}   Setup Completed Succesfully! ${NC}"
echo -e "${GREEN}============================${NC}"
echo -e "You can now run the app using: ./fullAppRun.sh"
