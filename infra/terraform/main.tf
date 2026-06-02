data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Default VPC subnets can span AZs like us-east-1e where t3.micro is unavailable.
data "aws_subnet" "default_vpc" {
  for_each = toset(data.aws_subnets.default.ids)
  id       = each.value
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  # Exclude **minimal** AMIs (`al2023-ami-minimal-*`): they often lack the EC2 Instance Connect
  # helper, so `send-ssh-public-key` succeeds but SSH still gets "Permission denied".
  filter {
    name   = "name"
    values = ["al2023-ami-20*-kernel-*-x86_64"]
  }
}

resource "aws_security_group" "api" {
  name_prefix = "crop-disease-api-"
  description = "SSH + API port for crop disease stack"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }

  ingress {
    description = "Flask/Gunicorn API"
    from_port   = var.api_port
    to_port     = var.api_port
    protocol    = "tcp"
    cidr_blocks = var.api_allowed_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  name_prefix        = "crop-disease-ec2-"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2" {
  name_prefix = "crop-disease-ec2-"
  role        = aws_iam_role.ec2.name
}

locals {
  # Avoid us-east-1e for burstable types (AWS returns Unsupported for t3.micro there).
  subnet_candidates = [
    for sid in data.aws_subnets.default.ids : sid
    if data.aws_subnet.default_vpc[sid].availability_zone != "us-east-1e"
  ]
  subnet_id = var.subnet_id != "" ? var.subnet_id : (
    length(local.subnet_candidates) > 0 ? local.subnet_candidates[0] : data.aws_subnets.default.ids[0]
  )
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  subnet_id                   = local.subnet_id
  vpc_security_group_ids      = [aws_security_group.api.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  associate_public_ip_address = var.associate_public_ip
  key_name                    = var.key_name != "" ? var.key_name : null

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.volume_size_gb
    delete_on_termination = true
  }

  user_data = <<-EOT
    #!/bin/bash
    # SSM agent first so Session Manager works even if later steps fail.
    set -uxo pipefail
    dnf install -y amazon-ssm-agent
    systemctl enable amazon-ssm-agent
    systemctl start amazon-ssm-agent

    set +e
    dnf update -y
    dnf install -y docker git
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ec2-user || true

    # 4 GB swap — prevents OOM when TF + PyTorch + ONNX all load simultaneously.
    if [ ! -f /swapfile ]; then
      fallocate -l 4G /swapfile
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi

    # Clone repo and deploy Docker container.
    REPO_URL="https://github.com/osmanyousaaf/fyp_crop_disease.git"
    REPO_DIR="/opt/fyp_crop_disease"
    git clone --depth 1 --branch main "$REPO_URL" "$REPO_DIR" 2>/dev/null \
      || git clone --depth 1 "$REPO_URL" "$REPO_DIR" || true

    if [ -d "$REPO_DIR" ]; then
      cd "$REPO_DIR"

      # Patch Gunicorn command to recycle worker every ~100 requests (prevents memory leak).
      sed -i 's/--worker-class gthread/--max-requests 100 --max-requests-jitter 20 --graceful-timeout 120 --worker-class gthread/' \
        infra/docker/Dockerfile.backend 2>/dev/null || true

      # Generate persistent secrets.
      SECRET_FILE="/etc/crop-api.env"
      if [ ! -f "$SECRET_FILE" ]; then
        JWT_SECRET_KEY="$(openssl rand -hex 32)"
        FLASK_SECRET_KEY="$(openssl rand -hex 32)"
        printf 'JWT_SECRET_KEY=%s\nFLASK_SECRET_KEY=%s\n' "$JWT_SECRET_KEY" "$FLASK_SECRET_KEY" > "$SECRET_FILE"
        chmod 600 "$SECRET_FILE"
      fi
      set -a; source "$SECRET_FILE"; set +a

      docker build -f infra/docker/Dockerfile.backend -t crop-api:latest . \
        && docker rm -f crop-api 2>/dev/null || true \
        && docker run -d \
             --name crop-api \
             --restart unless-stopped \
             -p 5020:5020 \
             -e PORT=5020 \
             -e FLASK_DEBUG=false \
             -e FLASK_SECRET_KEY="$FLASK_SECRET_KEY" \
             -e JWT_SECRET_KEY="$JWT_SECRET_KEY" \
             -e TF_CPP_MIN_LOG_LEVEL=2 \
             -e CUDA_VISIBLE_DEVICES=-1 \
             crop-api:latest
    fi
  EOT

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tags = {
    Name = "crop-disease-stack"
  }

  lifecycle {
    ignore_changes = [ami]
  }
}

resource "aws_eip" "app" {
  domain = "vpc"
  tags = {
    Name = "crop-disease-api-eip"
  }
}

resource "aws_eip_association" "app" {
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app.id
}
