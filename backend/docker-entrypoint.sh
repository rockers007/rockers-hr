#!/bin/sh
set -e

# Run migrations if the data-source file exists
if [ -f dist/data-source.js ]; then
  echo "Running database migrations..."
  npx typeorm migration:run -d dist/data-source.js || echo "Warning: migration failed"
else
  echo "Skipping migrations — dist/data-source.js not found"
fi

# Run seed if the seed script exists
if [ -f dist/database/seed.js ]; then
  echo "Running database seed..."
  node dist/database/seed.js || echo "Warning: seed failed"
else
  echo "Skipping seed — dist/database/seed.js not found"
fi

echo "Starting application..."
exec node dist/main.js
