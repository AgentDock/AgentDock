#!/bin/bash

# Script to properly handle clean installation of the project with correct handling of lock files

set -e # Exit on any error

echo "🧹 Cleaning up existing installations and build artifacts..."
rm -rf node_modules agentdock-core/node_modules agentdock-core/dist # Also remove core dist folder
rm -f pnpm-lock.yaml agentdock-core/pnpm-lock.yaml

echo "📦 Installing dependencies in one shot..."
pnpm install

echo "✅ Installation completed successfully!" 