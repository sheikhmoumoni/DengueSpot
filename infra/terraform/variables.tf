variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "name" {
  type = string
}

variable "availability_zones" {
  type = list(string)
}

variable "web_image" {
  type = string
}

variable "worker_image" {
  type = string
}

variable "certificate_arn" {
  type = string
}

variable "app_url" {
  type = string
}

variable "application_secret_arn" {

  type        = string
  description = "Existing Secrets Manager JSON: TRACKING_TOKEN_PEPPER, QR_SIGNING_SECRET, AUDIT_HASH_SECRET, SESSION_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY. Provision values out of band."

}

