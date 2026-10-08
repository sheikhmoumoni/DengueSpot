variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnets" {
  type = list(string)
}

variable "private_subnets" {
  type = list(string)
}

variable "application_security_group" {
  type = string
}

variable "load_balancer_security_group" {
  type = string
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

variable "application_secret_arn" {
  type = string
}

variable "database_host" {
  type = string
}

variable "database_secret_arn" {
  type = string
}

variable "bucket_name" {
  type = string
}

variable "bucket_arn" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "app_url" {
  type = string
}

variable "region" {
  type = string
}

resource "aws_cloudwatch_log_group" "application" {

  name              = "/denguespot/${var.name}"
  retention_in_days = 30

}

resource "aws_iam_role" "execution" {

  name_prefix = "${var.name}-execution-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }, Action = "sts:AssumeRole"
      }
    ]
    }
  )

}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "secrets" {

  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = [var.application_secret_arn, var.database_secret_arn]
      }
    ]
    }
  )

}

resource "aws_iam_role" "application" {

  name_prefix        = "${var.name}-application-"
  assume_role_policy = aws_iam_role.execution.assume_role_policy

}

resource "aws_iam_role_policy" "evidence" {

  role = aws_iam_role.application.id
  policy = jsonencode({
    Version = "2012-10-17", Statement = [{
      Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = ["${var.bucket_arn}/originals/*", "${var.bucket_arn}/derivatives/*"]
      }, {
      Effect = "Allow", Action = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"], Resource = var.kms_key_arn
      }
    ]
    }
  )

}

resource "aws_ecs_cluster" "main" {
  name = var.name
}

locals {

  environment = [for key, value in {
    NODE_ENV = "production", DEMO_MODE = "false", DATA_BACKEND = "postgres", STORAGE_BACKEND = "s3", S3_BUCKET = var.bucket_name, S3_KMS_KEY_ID = var.kms_key_arn, AWS_REGION = var.region, DATABASE_HOST = var.database_host, DATABASE_NAME = "denguespot", DATABASE_USER = "denguespot", DATABASE_SSL = "true", APP_URL = var.app_url, AI_TRIAGE_ENABLED = "false", SMS_ENABLED = "false"
    } : {
    name = key, value = value
    }
  ]
  secrets = concat([{
    name = "DATABASE_PASSWORD", valueFrom = "${var.database_secret_arn}:password::"
    }
    ], [for key in ["TRACKING_TOKEN_PEPPER", "QR_SIGNING_SECRET", "AUDIT_HASH_SECRET", "SESSION_SECRET", "SUPABASE_URL", "SUPABASE_ANON_KEY"] : {
      name = key, valueFrom = "${var.application_secret_arn}:${key}::"
    }
  ])

}

resource "aws_ecs_task_definition" "application" {

  for_each = {
    web = var.web_image, worker = var.worker_image
  }

  family                   = "${var.name}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.application.arn
  container_definitions = jsonencode([{
    name = each.key, image = each.value, essential = true, readonlyRootFilesystem = false, environment = local.environment, secrets = local.secrets, portMappings = each.key == "web" ? [{
      containerPort = 3000, protocol = "tcp"
      }
      ] : [], logConfiguration = {
      logDriver = "awslogs", options = {
        "awslogs-group" = aws_cloudwatch_log_group.application.name, "awslogs-region" = var.region, "awslogs-stream-prefix" = each.key
      }

    }

    }
  ])

}

resource "aws_lb" "main" {

  name               = var.name
  load_balancer_type = "application"
  internal           = false
  subnets            = var.public_subnets
  security_groups    = [var.load_balancer_security_group]

}

resource "aws_lb_target_group" "web" {

  name_prefix = "dsp-"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  health_check {
    path    = "/api/v1/ready"
    matcher = "200"
  }


}

resource "aws_lb_listener" "https" {

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }


}

resource "aws_lb_listener" "http" {

  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"
  default_action {

    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }


  }


}

resource "aws_ecs_service" "web" {

  name            = "${var.name}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.application["web"].arn
  desired_count   = 2
  launch_type     = "FARGATE"
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [var.application_security_group]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.https]

}

resource "aws_ecs_service" "worker" {

  name            = "${var.name}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.application["worker"].arn
  desired_count   = 1
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [var.application_security_group]
    assign_public_ip = false
  }


}

resource "aws_wafv2_web_acl" "main" {

  name  = var.name
  scope = "REGIONAL"
  default_action {
    allow {

    }

  }

  rule {

    name     = "ip-rate-limit"
    priority = 1
    action {
      block {

      }

    }

    statement {
      rate_based_statement {
        limit              = 1000
        aggregate_key_type = "IP"
      }

    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "denguespot-rate"
      sampled_requests_enabled   = false
    }


  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "denguespot-waf"
    sampled_requests_enabled   = false
  }


}

resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

output "dns_name" {
  value = aws_lb.main.dns_name
}

