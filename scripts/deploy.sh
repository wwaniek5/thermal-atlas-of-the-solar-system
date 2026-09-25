#!/usr/bin/env bash
# Build the site and upload it to the S3 bucket behind CloudFront.
# Needs the infrastructure from infra/site (terraform apply) to exist.
set -euo pipefail
cd "$(dirname "$0")/.."

bucket=$(terraform -chdir=infra/site output -raw bucket)
distribution=$(terraform -chdir=infra/site output -raw distribution_id)

npm run build

# Upload order keeps the live site working mid-deploy: new assets first,
# then data, and index.html (which points at the assets) last.

# Build assets have content hashes in their names, so they never change.
aws s3 sync dist/assets "s3://$bucket/assets" --delete \
  --cache-control "public, max-age=31536000, immutable"

# Data and other files keep their names across deploys: cache for a day;
# the invalidation below refreshes CloudFront right away.
aws s3 sync dist "s3://$bucket" --delete --exclude "assets/*" --exclude "index.html" \
  --cache-control "public, max-age=86400"

aws s3 cp dist/index.html "s3://$bucket/index.html" --cache-control "no-cache"

aws cloudfront create-invalidation --distribution-id "$distribution" --paths "/*" >/dev/null

echo "Deployed to $(terraform -chdir=infra/site output -raw url)"
