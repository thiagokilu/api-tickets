#!/bin/sh
set -e

# Run database migrations
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
fi

# Start the application
exec node dist/main
