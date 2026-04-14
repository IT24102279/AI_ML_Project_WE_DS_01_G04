#!/bin/bash

# fullAppRun.sh
# Master script to run all components of the AI Pharmacy POS system:
# 1. Main POS (Backend & Frontend)
# 2. Customer Service & Shop (Backend & Frontend)
# 3. AI OCR Model Pipeline

echo "=========================================="
echo "   AI Pharmacy POS - Full Application    "
echo "=========================================="

# Cleanup and exit handler
PIDS=()
cleanup() {
    echo -e "\n\nStopping all services..."
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
        fi
    done
    echo "Cleanup complete."
    exit
}
trap cleanup SIGINT SIGTERM

# --- 1. Customer Service & Shop Microservices ---
echo -e "\n[1/3] Starting Customer Service & Shop Microservices..."
cd backend_customer
if [ ! -d "node_modules" ]; then
    echo "  Installing backend dependencies..."
    npm install
fi
echo "  Seeding customer database..."
npx tsx src/seed.ts || echo "  (Database already exists or seed skipped)"
npx tsx src/index.ts &
PIDS+=($!)
cd ..

cd frontend_customer
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run dev &
PIDS+=($!)
cd ..


# --- 2. Main Pharmacy POS Services ---
echo -e "\n[2/3] Starting Main Pharmacy POS Services..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "  Installing backend dependencies..."
    npm install
fi
echo "  Seeding main database..."
npx tsx src/seed.ts || echo "  (Database already exists or seed skipped)"
npx tsx src/server.ts &
PIDS+=($!)
cd ..

cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run dev &
PIDS+=($!)
cd ..


# --- 3. AI OCR Model Pipeline ---
echo -e "\n[3/3] Starting AI OCR Model Pipeline..."
cd ai_OCR_Model
py=$(command -v python3 || command -v python)
if [ -z "$py" ]; then
    echo "Error: Python not found!"
else
    # Quick check for requirements
    echo "  Checking Python requirements..."
    $py -c "import flask, dotenv, requests, torch, cv2" 2>/dev/null || {
        echo "  Installing requirements for OCR..."
        $py -m pip install -r requirements.txt
    }
    $py ocr.py &
    PIDS+=($!)
fi
cd ..


# --- Final Status ---
echo "=========================================="
echo "All components are starting!"
echo "Main POS URL:      http://localhost:5173"
echo "Customer App URL:  http://localhost:5174"
echo "OCR Backend URL:   http://localhost:5005"
echo "=========================================="
echo "Press [CTRL+C] to stop all services."

# Wait for background processes
wait
