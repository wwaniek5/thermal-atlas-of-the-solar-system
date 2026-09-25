---
name: deploy-site
description: Deploy the isotherm globe to AWS (S3 + CloudFront) or change its Terraform infrastructure in infra/. Use when asked to deploy, publish, release, or change hosting.
---

# Deploying the site

Hosting is a private S3 bucket behind CloudFront, managed by Terraform in `infra/`.
Get the live URL with `terraform -chdir=infra/site output -raw url`.

## Deploy the current code

```bash
scripts/deploy.sh
```

This builds, uploads with cache headers (hashed `assets/` are cached forever,
data for 1 day, `index.html` is always re-checked), and invalidates CloudFront.
Afterwards, check the live URL loads with no console errors.

## Change infrastructure

1. Edit `infra/site/main.tf`, then run `terraform fmt -recursive infra`.
2. Run `terraform -chdir=infra/site plan -out=site.tfplan` and **show the plan to
   the user; apply only after they approve.**
3. Run `terraform -chdir=infra/site apply site.tfplan`, then delete `site.tfplan`.

State lives in the S3 bucket created once by `infra/bootstrap`. That config
keeps its own state locally and gitignored; don't re-run it.

## Gotchas

- Credentials need the actions in `infra/iam/deploy-policy.json` (plus read access).
- Pushing the ~34 MB of data over HTTPS needs `git config http.postBuffer 157286400`.
- CloudFront gives 1,000 free invalidation paths per month, and each deploy uses one (`/*`).
