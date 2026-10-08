variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnets" {
  type = list(string)
}

variable "application_security_group" {
  type = string
}

variable "environment" {
  type = string
}

resource "aws_kms_key" "data" {

  description             = "DengueSpot storage encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30

}

resource "aws_db_subnet_group" "database" {
  subnet_ids = var.private_subnets
}

resource "aws_security_group" "database" {

  vpc_id = var.vpc_id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.application_security_group]
  }


}

resource "aws_db_instance" "database" {

  identifier                      = "${var.name}-postgres"
  engine                          = "postgres"
  instance_class                  = "db.t4g.small"
  allocated_storage               = 30
  max_allocated_storage           = 100
  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.data.arn
  db_name                         = "denguespot"
  username                        = "denguespot"
  manage_master_user_password     = true
  db_subnet_group_name            = aws_db_subnet_group.database.name
  vpc_security_group_ids          = [aws_security_group.database.id]
  publicly_accessible             = false
  backup_retention_period         = 14
  deletion_protection             = var.environment == "production"
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${var.name}-final"
  multi_az                        = var.environment == "production"
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

}

resource "aws_s3_bucket" "evidence" {

  bucket_prefix = "${var.name}-private-"
  force_destroy = false

}

resource "aws_s3_bucket_public_access_block" "evidence" {

  bucket                  = aws_s3_bucket.evidence.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

}

resource "aws_s3_bucket_server_side_encryption_configuration" "evidence" {

  bucket = aws_s3_bucket.evidence.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }

  }


}

resource "aws_s3_bucket_versioning" "evidence" {

  bucket = aws_s3_bucket.evidence.id
  versioning_configuration {
    status = "Enabled"
  }


}

resource "aws_s3_bucket_lifecycle_configuration" "evidence" {

  bucket = aws_s3_bucket.evidence.id
  rule {

    id     = "bounded-version-retention"
    status = "Enabled"
    filter {
      prefix = ""
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }


  }


}

resource "aws_s3_bucket_policy" "tls" {

  bucket = aws_s3_bucket.evidence.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Deny", Principal = "*", Action = "s3:*", Resource = [aws_s3_bucket.evidence.arn, "${aws_s3_bucket.evidence.arn}/*"], Condition = {
        Bool = {
          "aws:SecureTransport" = "false"
        }

      }

      }
    ]
    }
  )

}

output "database_host" {
  value = aws_db_instance.database.address
}

output "database_secret_arn" {
  value = aws_db_instance.database.master_user_secret[0].secret_arn
}

output "bucket_name" {
  value = aws_s3_bucket.evidence.id
}

output "bucket_arn" {
  value = aws_s3_bucket.evidence.arn
}

output "kms_key_arn" {
  value = aws_kms_key.data.arn
}

