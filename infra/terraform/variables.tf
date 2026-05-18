variable "aws_region" {
  type        = string
  description = "AWS region for EC2 and EIP."
  default     = "us-east-1"
}

variable "instance_type" {
  type        = string
  description = "EC2 size: backend + local APK builds need RAM and disk (e.g. t3.xlarge)."
  default     = "t3.xlarge"
}

variable "volume_size_gb" {
  type        = number
  description = "Root GP3 volume size (Android SDK + Gradle cache needs space)."
  default     = 120
}

variable "api_port" {
  type        = number
  description = "Port Flask/Gunicorn listens on inside the instance."
  default     = 5020
}

variable "ssh_cidr" {
  type        = string
  description = "CIDR allowed for SSH (your public IP/32 recommended)."
  default     = "0.0.0.0/0"
}

variable "api_allowed_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to reach the API port (mobile apps often need 0.0.0.0/0 unless behind VPN)."
  default     = ["0.0.0.0/0"]
}

variable "key_name" {
  type        = string
  description = "Existing EC2 Key Pair name in this region (optional if you only use SSM)."
  default     = ""
}

variable "subnet_id" {
  type        = string
  description = "Explicit subnet ID (leave empty to pick first subnet in the default VPC)."
  default     = ""
}

variable "associate_public_ip" {
  type        = bool
  description = "Assign a public IP on the primary ENI (recommended when not using a NAT)."
  default     = true
}
