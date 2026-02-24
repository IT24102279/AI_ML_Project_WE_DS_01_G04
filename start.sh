#!/bin/bash
echo "Waiting for MySQL database to initialize..."
while ! docker exec pharmacy-mysql mysqladmin ping -h localhost --silent; do
    sleep 3
done

echo "Database is ready."
cd backend
echo "Setting up database schema and seeding..."
/tmp/fnm/fnm exec --using=20 npx tsx src/seed.ts


echo "Starting Backend Server on port 5000..."
/tmp/fnm/fnm exec --using=20 npx tsx src/server.ts &

cd ../frontend
echo "Starting Frontend App on port 5173..."
/tmp/fnm/fnm exec --using=20 npm run dev &

echo "Pharmacy POS system is running."
wait
