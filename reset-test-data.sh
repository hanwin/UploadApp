#!/bin/bash

set -euo pipefail

echo "Running test data reset script in backend service..."
docker compose exec backend node /app/scripts/reset-for-testing.js
