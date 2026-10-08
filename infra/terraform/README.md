# Portable production reference: AWS

Modules provision an isolated VPC, private PostgreSQL RDS instance, KMS-encrypted private evidence bucket, Secrets Manager database password, ECS Fargate web/worker, HTTPS ALB, WAF IP rate control and application logs. RDS automated backups are encrypted and retained 14 days. Production enables Multi-AZ and deletion protection. Application IAM has evidence-prefix object operations and the data key, no bucket listing or infrastructure administration.

This is a reference, not a deployed environment. Select and legally approve the hosting region and processors. Configure AWS credentials, ACM certificate, DNS, ECR image digests, a pre-created application secret and state backend with encrypted/versioned remote storage. Do not put secret values in tfvars/state. Supabase Auth remains an external managed identity adapter; enforce MFA and provision verified authority membership rows. RDS PostGIS is enabled by the SQL migration, not a fabricated Terraform extension resource. Run migrations from a controlled runner inside the VPC, then seed only staging demo data when desired. Production gets validated authority polygons/profiles, never synthetic data by default.

```sh
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform fmt -recursive
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform plan -var-file=environments/staging/terraform.tfvars
terraform -chdir=infra/terraform apply -var-file=environments/staging/terraform.tfvars
```

Before apply: replace examples, inspect costs (NAT, ALB, RDS, Fargate and WAF), pin images/providers, configure RDS CA trust in the container, create a least-privilege application DB role after owner migrations, configure per-provider egress, alarms, scheduled retention and backup restore tests. The reference initially uses the managed DB owner credential; this is a documented release blocker, not the final least-privilege database identity. A single NAT is economical for staging; production should use one per AZ. S3 versions expire after 30 days; deletion/rights must be reconciled with version/backup retention. ALB provides the load-balancer equivalent; a CDN for static assets can be added without caching private APIs.

Runtime uses DATABASE_HOST/USER/PASSWORD to construct DATABASE_URL without logging it, S3 with IAM task credentials and server-proxied authorization. Supabase private storage remains the Vercel default. No AWS resources have been applied by this task.
