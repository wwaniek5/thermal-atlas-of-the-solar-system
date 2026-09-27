#!/usr/bin/env bash
# Build the site and upload it to the S3 bucket behind CloudFront.
# Needs the infrastructure from infra/site (terraform apply) to exist.
#
# Caching: build assets and data folders have content hashes in their names,
# so they are cached forever. The HTML pages and the data manifests (which
# point at those names) are re-checked on every visit, so no CloudFront
# invalidation is needed.
set -euo pipefail
cd "$(dirname "$0")/.."

bucket=$(terraform -chdir=infra/site output -raw bucket)

npm run build

forever="public, max-age=31536000, immutable"

# Upload order keeps the live site working mid-deploy: everything that is
# referenced first, the files that reference it (manifests, index.html) last.
aws s3 sync dist/assets "s3://$bucket/assets" --delete --cache-control "$forever"
aws s3 sync dist/data "s3://$bucket/data" --delete --exclude "*/manifest.json" --cache-control "$forever"
aws s3 sync dist "s3://$bucket" --delete --exclude "assets/*" --exclude "data/*" --exclude "*.html" \
  --cache-control "public, max-age=86400"
aws s3 cp dist/data "s3://$bucket/data" --recursive --exclude "*" --include "*/manifest.json" \
  --cache-control "no-cache"
# The pages (index.html and one per body, see scripts/prerender.ts) name the
# current build's assets, so they are re-checked on every visit.
aws s3 sync dist "s3://$bucket" --delete --exclude "*" --include "*.html" --cache-control "no-cache"

echo "Deployed to $(terraform -chdir=infra/site output -raw url)"
