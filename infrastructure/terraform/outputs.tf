output "active_endpoint" {
  value       = local.endpoint
  description = "Поточний ендпоінт LocalStack"
}

output "deployment_mode" {
  value = var.is_remote_server ? "Server-Side Execution (K8s DNS)" : "Local Execution (SSH Tunnel)"
}

output "s3_bucket_name" {
  value = aws_s3_bucket.project_assets.bucket
}
