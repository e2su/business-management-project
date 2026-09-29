output "public_ip" {
  value = azurerm_public_ip.pip.ip_address
}

output "api_url" {
  value = "http://${azurerm_public_ip.pip.ip_address}:8000/docs"
}

output "powerbi_postgres_server" {
  description = "Use in Power BI: Get data -> PostgreSQL database -> Server"
  value       = "${azurerm_public_ip.pip.ip_address}:5432"
}

output "powerbi_user" {
  description = "Read-only database login for Power BI (password = var.powerbi_password)"
  value       = "powerbi"
}

output "ssh" {
  value = "ssh ${var.admin_username}@${azurerm_public_ip.pip.ip_address}"
}

output "sftp_landing_zone" {
  description = "Source systems can drop files here over SFTP/SCP"
  value       = "${var.admin_username}@${azurerm_public_ip.pip.ip_address}:/srv/salesdw/app/data/incoming/"
}
