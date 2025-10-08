#!/bin/bash

# Load environment variables
export BINOMO_AUTHTOKEN="${BINOMO_AUTHTOKEN:-2ba71577-82f7-4751-8902-4de7f0c94831}"
export BINOMO_DEVICE_ID="${BINOMO_DEVICE_ID:-636d5616769d02c84c488e3353f28789}"
export BINOMO_DEVICE_TYPE="${BINOMO_DEVICE_TYPE:-web}"
export BINOMO_SERVICE_PORT="${BINOMO_SERVICE_PORT:-5001}"

echo "🚀 Starting Binomo API Service..."
echo "📡 AUTHTOKEN: ${BINOMO_AUTHTOKEN:0:10}..."
echo "📱 DEVICE_ID: ${BINOMO_DEVICE_ID:0:10}..."
echo "🌐 PORT: $BINOMO_SERVICE_PORT"

# Run the Binomo service
python binomo_service.py
