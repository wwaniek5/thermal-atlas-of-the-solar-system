# The website: a private S3 bucket served over HTTPS by CloudFront.
#
#   terraform -chdir=infra/site init
#   CLOUDFLARE_API_TOKEN=... terraform -chdir=infra/site apply   # see the deploy-site skill
#   scripts/deploy.sh          # build and upload the site

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # Created by infra/bootstrap. Backend settings can't use variables.
  backend "s3" {
    bucket       = "isotherms-tfstate-715991412184"
    key          = "site/terraform.tfstate"
    region       = "eu-north-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = "isotherms" }
  }
}

variable "region" {
  type    = string
  default = "eu-north-1"
}

# CloudFront only uses certificates from us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = { Project = "isotherms" }
  }
}

# Reads the API token from CLOUDFLARE_API_TOKEN (DNS edit and zone read on the domain only).
provider "cloudflare" {}

# Our own address, registered at Cloudflare. Its DNS, managed here, points it
# and www at the distribution and holds the certificate's validation records.
# Records are "DNS only": CloudFront serves HTTPS itself.
variable "domain" {
  type    = string
  default = "isotherms.org"
}

resource "aws_acm_certificate" "site" {
  provider                  = aws.us_east_1
  domain_name               = var.domain
  subject_alternative_names = ["www.${var.domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

data "cloudflare_zone" "site" {
  filter = { name = var.domain }
}

# Proves to AWS that we own the domain and www.
resource "cloudflare_dns_record" "cert_validation" {
  for_each = {
    for o in aws_acm_certificate.site.domain_validation_options : o.domain_name => o
  }
  zone_id = data.cloudflare_zone.site.id
  name    = trimsuffix(each.value.resource_record_name, ".")
  type    = each.value.resource_record_type
  content = trimsuffix(each.value.resource_record_value, ".")
  ttl     = 1 # automatic
  proxied = false
  comment = "ACM certificate validation (Terraform, infra/site)"
}

# Waits until AWS has issued the certificate.
resource "aws_acm_certificate_validation" "site" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for r in cloudflare_dns_record.cert_validation : r.name]
}

# The domain and www point at CloudFront (Cloudflare flattens the CNAME at
# the root). After the distribution knows the names, or visitors get errors.
resource "cloudflare_dns_record" "site" {
  for_each   = toset([var.domain, "www.${var.domain}"])
  zone_id    = data.cloudflare_zone.site.id
  name       = each.value
  type       = "CNAME"
  content    = aws_cloudfront_distribution.site.domain_name
  ttl        = 1
  proxied    = false
  comment    = "Site on CloudFront (Terraform, infra/site)"
  depends_on = [aws_cloudfront_distribution.site]
}

data "aws_caller_identity" "current" {}

# Files are uploaded by scripts/deploy.sh, not by Terraform.
resource "aws_s3_bucket" "site" {
  bucket = "isotherms-site-${data.aws_caller_identity.current.account_id}"
}

# Private: only CloudFront reads it.
resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = aws_s3_bucket.site.bucket
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Page routes like /earth aren't files in the bucket: serve the app for any
# path without a file extension. Missing files (data, assets) still get a
# real error instead of the app's HTML.
resource "aws_cloudfront_function" "routes" {
  name    = "isotherms-routes"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      // Any other name (www, the distribution's own cloudfront.net address)
      // redirects to the domain.
      if (request.headers.host && request.headers.host.value !== '${var.domain}') {
        return {
          statusCode: 301,
          statusDescription: 'Moved Permanently',
          headers: { location: { value: 'https://${var.domain}' + request.uri } },
        };
      }
      // Pages: / is index.html, /saturn is saturn.html (written per body by
      // scripts/prerender.ts). Other paths are files. Unknown pages get
      // index.html with a 404 (custom_error_response below).
      var uri = request.uri.replace(/\/+$/, '');
      var last = uri.split('/').pop();
      if (uri === '') request.uri = '/index.html';
      else if (last.indexOf('.') === -1) request.uri = uri.toLowerCase() + '.html';
      return request;
    }
  EOT
}

# AWS-managed cache policy that honours the Cache-Control headers
# deploy.sh sets, and compresses with gzip/brotli.
data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  comment             = "Isotherm globe"
  aliases             = [var.domain, "www.${var.domain}"]
  default_root_object = "index.html"
  http_version        = "http2and3"
  # North America and Europe edge locations only: the cheapest option.
  price_class = "PriceClass_100"

  origin {
    origin_id                = "site"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.routes.arn
    }
  }

  # A missing file or unknown page (S3 answers 403: CloudFront may not list
  # the bucket) gets the home page, which sends the visitor to /, as a 404
  # so search engines don't index it.
  dynamic "custom_error_response" {
    for_each = [403, 404]
    content {
      error_code            = custom_error_response.value
      response_code         = 404
      response_page_path    = "/index.html"
      error_caching_min_ttl = 60
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# Let this distribution, and nothing else, read the bucket.
resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudFrontRead"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.site.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site.arn }
      }
    }]
  })
  depends_on = [aws_s3_bucket_public_access_block.site]
}

output "url" {
  value = "https://${var.domain}"
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "bucket" {
  value = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

# The DNS records that prove we own var.domain and www, for Cloudflare.
output "certificate_validation" {
  value = [for o in aws_acm_certificate.site.domain_validation_options : {
    name  = o.resource_record_name
    type  = o.resource_record_type
    value = o.resource_record_value
  }]
}
