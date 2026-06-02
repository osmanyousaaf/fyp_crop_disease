# AWS deployment (Terraform + EC2)

This folder provisions **one EC2 instance** on the **default VPC**, attaches a **stable Elastic IP**, opens **SSH** and the **API port** (default **5020**), installs **Docker** via user-data, and documents how to run the **backend container** and build an **Android APK** on the same host.

## Prerequisites

- AWS account + credentials configured locally (`aws configure` or env vars).
- [Terraform](https://developer.hashicorp.com/terraform/install) ≥ 1.5.
- An EC2 **key pair** name in the target region (optional if you only use **AWS Systems Manager Session Manager**).

## 1. Deploy infrastructure

```bash
cd infra/terraform
terraform init
terraform apply
```

Important variables (override with `-var` or a `terraform.tfvars` file):

| Variable            | Default       | Notes                                      |
|---------------------|---------------|--------------------------------------------|
| `aws_region`        | `us-east-1`   |                                            |
| `instance_type`     | `t3.micro`    | **Educate / Free Tier–only accounts** cannot launch `t3.xlarge`; use `t3.micro`/`t2.micro` or remove the restriction, then scale up for ML + Android builds. |
| `volume_size_gb`    | `30`          | Raise (e.g. `120`) when building APKs on the box if you have disk headroom. |
| `ssh_cidr`          | `0.0.0.0/0`   | **Restrict** to your IP (`x.x.x.x/32`).    |
| `key_name`          | `""`          | Set to your key pair name for SSH.        |

Outputs:

- `elastic_ip` — use this in the mobile app as `EXPO_PUBLIC_API_URL=http://<IP>:5020`.
- `api_base_url` — quick copy/paste base URL.

## 2. Put code on the instance

Pick one:

- **Git clone** (recommended): clone [your GitHub repo](https://github.com/osmanyousaaf/fyp_crop_disease) onto `/home/ec2-user/fyp_crop_disease` on the instance.
- **SCP/rsync** from your laptop.

Ensure the repo contains **`backend/`**, **`FYP_PlantDisease/`**, and **`crop leaves  2nd models saved/`** (names must match; paths are used by Flask).

## 3. Run the backend in Docker

SSH or SSM into the instance, then:

```bash
cd ~/fyp_crop_disease   # or your clone path
chmod +x infra/scripts/deploy-backend-docker-on-ec2.sh
sudo bash infra/scripts/deploy-backend-docker-on-ec2.sh
```

Smoke test from your laptop:

```bash
curl "http://<ELASTIC_IP>:5020/api/health"
```

Smoke test all routes from your laptop (needs `curl` + `python3`):

```bash
bash infra/scripts/smoke-test-aws-api.sh
```

Production notes:

- On first deploy the script creates **`/etc/crop-api.env`** with random **`JWT_SECRET_KEY`** and **`FLASK_SECRET_KEY`** (64 hex chars each) and reuses it on later redeploys. Override by setting those variables before running the script, or delete the file to rotate secrets.
- **`WORKER TIMEOUT` / SIGKILL / OOM** on **`t3.micro`**: upgrade **`instance_type`** (e.g. **`t3.small`** or **`t3.medium`**) in Terraform and `terraform apply`.
- Set strong secrets via `-e` on `docker run` in the deploy script (`FLASK_SECRET_KEY`, `JWT_SECRET_KEY`, OAuth/email vars) — avoid committing real values.
- For HTTPS, put **Application Load Balancer + ACM** or **CloudFront** in front; update the app URL accordingly.

## 4. Android toolchain on EC2 (one-time)

```bash
chmod +x infra/scripts/setup-android-builder-amazon-linux-2023.sh
sudo bash infra/scripts/setup-android-builder-amazon-linux-2023.sh
# Append the printed exports to ~/.bashrc, then: source ~/.bashrc
```

## 5. Build a debug APK on EC2

Point the app at your Elastic IP (same port as the API):

```bash
cd ~/fyp_crop_disease
chmod +x infra/scripts/build-android-apk-on-ec2.sh
API_PUBLIC_URL="http://<ELASTIC_IP>:5020" bash infra/scripts/build-android-apk-on-ec2.sh
```

The script writes `frontCrops/.env.local`, runs `expo prebuild`, and **`assembleDebug`**.

- Output path is printed at the end (`app/build/outputs/apk/debug/…`).
- **Release / Play Store** signing is not configured here; add a keystore and Gradle signing config for production.

## Security checklist

- Tighten **`ssh_cidr`** and consider restricting **`api_allowed_cidrs`** if you use a VPN.
- Do **not** commit real `.env` / API keys; use SSM Parameter Store or Secrets Manager for production.

## Troubleshooting

- **`Permission denied` after EC2 Instance Connect `Success: true`**: The AMI was likely **Amazon Linux 2023 Minimal**, which often **does not install the Instance Connect helper**. Terraform now prefers **non-minimal** AMIs (`al2023-ami-20*-…`). **Best fix:** create an EC2 **key pair**, set **`key_name`** in `terraform.tfvars`, then **`terraform apply -replace=aws_instance.app`** and use **`ssh -i your.pem ec2-user@<elastic_ip>`**.
