variable "project" {
  type    = string
  default = "salesdw"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "location" {
  type    = string
  default = "westeurope"
}

variable "vm_size" {
  description = "B2ms (2 vCPU / 8 GB) is plenty for millions of sales lines; scale up as data grows."
  type        = string
  default     = "Standard_B2ms"
}

variable "data_disk_gb" {
  type    = number
  default = 128
}

variable "admin_username" {
  type    = string
  default = "azureuser"
}

variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/id_rsa.pub"
}

variable "allowed_cidrs" {
  description = "IP ranges allowed to reach SSH, the API and PostgreSQL (office, Power BI gateway, source systems)."
  type        = list(string)
}

variable "repo_url" {
  description = "Git URL of this project (the VM clones it on first boot)."
  type        = string
}

variable "repo_branch" {
  type    = string
  default = "main"
}

variable "postgres_password" {
  type      = string
  sensitive = true
}

variable "api_key" {
  description = "Value for the X-API-Key header of the management API."
  type        = string
  sensitive   = true
}

variable "powerbi_password" {
  description = "Password of the read-only 'powerbi' database login used by Power BI / the data gateway."
  type        = string
  sensitive   = true
}

variable "auto_shutdown_time" {
  description = "HHMM daily shutdown time, empty string to disable."
  type        = string
  default     = ""
}

variable "auto_shutdown_timezone" {
  type    = string
  default = "UTC"
}
