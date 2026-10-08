module "network" {

  source             = "./modules/network"
  name               = var.name
  availability_zones = var.availability_zones

}

module "data" {

  source                     = "./modules/data"
  name                       = var.name
  vpc_id                     = module.network.vpc_id
  private_subnets            = module.network.private_subnets
  application_security_group = module.network.application_security_group
  environment                = var.environment

}

module "runtime" {

  source                       = "./modules/runtime"
  name                         = var.name
  vpc_id                       = module.network.vpc_id
  public_subnets               = module.network.public_subnets
  private_subnets              = module.network.private_subnets
  application_security_group   = module.network.application_security_group
  load_balancer_security_group = module.network.load_balancer_security_group
  web_image                    = var.web_image
  worker_image                 = var.worker_image
  certificate_arn              = var.certificate_arn
  app_url                      = var.app_url
  application_secret_arn       = var.application_secret_arn
  database_host                = module.data.database_host
  database_secret_arn          = module.data.database_secret_arn
  bucket_name                  = module.data.bucket_name
  bucket_arn                   = module.data.bucket_arn
  kms_key_arn                  = module.data.kms_key_arn
  region                       = var.region

}

output "load_balancer_dns" {
  value = module.runtime.dns_name
}

output "database_secret_arn" {
  value = module.data.database_secret_arn
}

