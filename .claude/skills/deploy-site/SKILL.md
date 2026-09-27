---
name: deploy-site
description: Deploy the isotherm globe to AWS (S3 + CloudFront) or change its Terraform infrastructure in infra/. Use when asked to deploy, publish, release, or change hosting.
---

# Deploying the site

Hosting is a private S3 bucket behind CloudFront, managed by Terraform in `infra/`.
The site is at https://isotherms.org (www redirects there). The domain is
registered at Cloudflare, whose DNS Terraform also manages; the certificate is
in AWS Certificate Manager (us-east-1). Get the URL with
`terraform -chdir=infra/site output -raw url`.

## Deploy the current code

```bash
scripts/deploy.sh
```

This builds (including a static page per body, see `scripts/prerender.ts`)
and uploads with cache headers: `assets/` and the versioned data
folders (`data/<source>/<hash>/`) are cached forever; the HTML pages and the data
manifests are re-checked on every visit, so no CloudFront invalidation is
needed. Afterwards, check the live URL loads with no console errors.

## Change infrastructure

1. Edit `infra/site/main.tf`, then run `terraform fmt -recursive infra`.
2. Run `terraform -chdir=infra/site plan -out=site.tfplan` and **show the plan to
   the user; apply only after they approve.**
3. Run `terraform -chdir=infra/site apply site.tfplan`, then delete `site.tfplan`.

Terraform needs a Cloudflare API token (DNS edit + zone read on the domain) in
`CLOUDFLARE_API_TOKEN`. Each person keeps their own; for example, in the macOS
Keychain:

```bash
security add-generic-password -U -a "$USER" -s isotherms-cloudflare -w   # once, paste the token
CLOUDFLARE_API_TOKEN="$(security find-generic-password -a "$USER" -s isotherms-cloudflare -w)" \
  terraform -chdir=infra/site plan -out=site.tfplan
```

Never print the token or write it to a file.

State lives in the S3 bucket created once by `infra/bootstrap`. That config
keeps its own state locally and gitignored; don't re-run it.

## Gotchas

- The CloudFront function in `infra/site/main.tf` maps `/saturn` to `saturn.html`
  and redirects other host names to isotherms.org. Unknown pages get `index.html`
  with a 404. Deploy new pages before pointing the function at them.

- Credentials need the actions in `infra/iam/deploy-policy.json` (plus read access).
- Pushing the ~34 MB of data over HTTPS needs `git config http.postBuffer 157286400`.
- When changing a file's cache headers or layout, remember that CloudFront (and
  browsers) keep the old copy for its old max-age. Invalidate the affected paths once
  (`aws cloudfront create-invalidation --paths ...`) as part of that deploy.
- Never overwrite a file inside `data/<source>/<hash>/` in place, since it's cached forever.
  New data must come from `prepare_data.py`, which writes a new hash folder.
