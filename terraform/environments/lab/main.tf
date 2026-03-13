provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    dynamodb = var.localstack_endpoint
    ecr      = var.localstack_endpoint
  }
}

module "products_table" {
  source     = "../../modules/dynamodb-table"
  table_name = "cloudmart_products"
  hash_key   = "pk"
  range_key  = "sk"
}

module "orders_table" {
  source     = "../../modules/dynamodb-table"
  table_name = "cloudmart_orders"
  hash_key   = "pk"
  range_key  = "sk"
}

module "tickets_table" {
  source     = "../../modules/dynamodb-table"
  table_name = "cloudmart_tickets"
  hash_key   = "pk"
  range_key  = "sk"
}

#module "agent_gateway_ecr" {
#  source               = "../../modules/ecr-repository"
#  name                 = "agent-gateway"
#  image_tag_mutability = "MUTABLE"
#  scan_on_push         = false
#}
