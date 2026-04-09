variable "is_remote_server" {
  type        = bool
  default     = false
  description = "Встановіть true, якщо запускаєте terraform безпосередньо на сервері aorus (використовує внутрішній DNS K8s)"
}

variable "region" {
  type    = string
  default = "us-east-1"
}
