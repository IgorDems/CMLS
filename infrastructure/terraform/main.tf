locals {
  # Вибір ендпоінту: внутрішній для сервера або localhost для тунелю
  endpoint = var.is_remote_server ? "http://localstack.default.svc.cluster.local:4566" : "http://localhost:4566"
}

terraform {
  required_version = ">= 1.5.0"

  backend "local" {
    path = "terraform.tfstate"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                       = var.region
  access_key                   = "test"
  secret_key                   = "test"
  skip_credentials_validation  = true
  skip_metadata_api_check      = true
  skip_requesting_account_id   = true
  s3_use_path_style            = true

  endpoints {
    s3             = local.endpoint
    dynamodb       = local.endpoint
    iam            = local.endpoint
    sts            = local.endpoint
    route53        = local.endpoint
    ec2            = local.endpoint
    cloudwatch     = local.endpoint
    lambda         = local.endpoint
  }
}

# --- Ресурси проекту ---

resource "aws_s3_bucket" "project_assets" {
  bucket        = "multicloud-ai-project-assets"
  force_destroy = true
}

resource "aws_dynamodb_table" "project_metadata" {
  name         = "multicloud-project-metadata"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ProjectID"

  attribute {
    name = "ProjectID"
    type = "S"
  }

  tags = {
    Environment = "Local-Dev"
    Project     = "MultiCloud-AI"
  }
}
