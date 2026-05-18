variable "aws_region" {
  type        = string
  description = "AWS region for EC2 and EIP."
  default     = "us-east-1"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type. Some accounts (e.g. AWS Educate / Free Tier–only) only allow free-tier sizes — use t3.micro or t2.micro there. For Docker + TensorFlow + Android builds, use t3.xlarge or larger when your account allows it."
  default     = "t3.micro"
}

variable "volume_size_gb" {
  type        = number
  description = "Root GP3 volume size. Free Tier includes limited EBS; 30 GB stays within typical trial allowance. Raise for Android SDK + Gradle (e.g. 120) when not cost-sensitive."
  default     = 30
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
  description = "EC2 Key Pair name in this region (**strongly recommended**). Without it, SSH relies on EC2 Instance Connect, which fails on minimal AMIs and is awkward on Educate accounts."
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
