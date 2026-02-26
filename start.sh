#!/bin/bash

# Ensure MySQL is running
if ! docker ps -a | grep -q pharmacy-mysql; then
    echo "Creating and starting MySQL container..."
    docker run -d --name pharmacy-mysql \
        -e MYSQL_ROOT_PASSWORD=root \
        -e MYSQL_DATABASE=pharmacy_pos \
        -p 3306:3306 \
        mysql:8.4
else
    if ! docker ps | grep -q pharmacy-mysql; then
        echo "Starting existing MySQL container..."
        docker start pharmacy-mysql
    fi
fi

echo "Waiting for MySQL database to initialize..."
while ! docker exec pharmacy-mysql mysqladmin ping -h localhost --silent; do
    sleep 3
done

echo "Database is ready."

# Start Backend
echo "Starting Backend Server..."
cd backend
# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    /tmp/fnm/fnm exec --using=20 npm install
fi

echo "Setting up database schema and seeding..."
/tmp/fnm/fnm exec --using=20 npx tsx src/seed.ts

echo "Running Backend on port 5000..."
/tmp/fnm/fnm exec --using=20 npx tsx src/server.ts &
BACKEND_PID=$!

# Start Frontend
echo "Starting Frontend App..."
cd ../frontend
# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    /tmp/fnm/fnm exec --using=20 npm install
fi

echo "Running Frontend on port 5173..."
/tmp/fnm/fnm exec --using=20 npm run dev &
FRONTEND_PID=$!

echo "Pharmacy POS system is running."
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Wait for Ctrl+C to stop both processes
trap "kill $BACKEND_PID $FRONTEND_PID" SIGINT SIGTERM
wait
