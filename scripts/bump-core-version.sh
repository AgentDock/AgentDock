#!/bin/bash
# Purpose: Create a new version of agentdock-core
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Please provide a version number (e.g., 1.0.0)"
  exit 1
fi

# Make sure we're in the repository root
if [ ! -d "agentdock-core" ]; then
  echo "Error: agentdock-core directory not found"
  echo "Make sure you run this script from the repository root"
  exit 1
fi

# Update package.json version
cd agentdock-core
npm version $VERSION --no-git-tag-version
cd ..

# Commit the change
git add agentdock-core/package.json
git commit -m "chore: bump agentdock-core to v$VERSION"

# Create core-specific tag
git tag core-v$VERSION

echo "✅ Updated agentdock-core to v$VERSION"
echo "✅ Created tag core-v$VERSION"
echo "📌 Don't forget to push with: git push && git push --tags"