output "products_table" {
  value = module.products_table.table_name
}

output "orders_table" {
  value = module.orders_table.table_name
}

output "tickets_table" {
  value = module.tickets_table.table_name
}

#output "agent_gateway_ecr_repository_url" {
#  value = module.agent_gateway_ecr.repository_url
#}
