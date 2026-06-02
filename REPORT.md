# Crop Disease Prediction — AWS Deployment Report

This document summarizes **what was implemented or fixed** for hosting the Flask backend on **AWS EC2**, and **how to upload / deploy** the application step by step.

For shorter operational commands, see [`infra/README.md`](infra/README.md).

---

## 1. Architecture overview

| Piece | Role |
|--------|------|
| **Terraform** (`infra/terraform/`) | Creates EC2 (Amazon Linux 2023), security group (SSH + API port **5020**), Elastic IP, IAM for SSM optional access |
| **Docker** | Builds and runs the backend image from `infra/docker/Dockerfile.backend` |
| **Gunicorn** | Serves `backend/app.py` on `0.0.0.0:5020` |
| **Elastic IP** | Stable public address for the mobile/web client (`EXPO_PUBLIC_API_URL`) |

The EC2 instance **does not** store your API keys in this report — configure secrets via Docker `-e` or AWS Secrets Manager for production.

---

## 2. What was done (technical summary)

### 2.1 Shell scripts and line endings

Deploy scripts under `infra/scripts/*.sh` had **Windows CRLF** line endings in some clones. On Linux, bash then fails on `set -euo pipefail` with errors like **`set: pipefail` / invalid option**.

**Fix:** Normalize scripts to **LF** line endings and add **`.gitattributes`** (`*.sh text eol=lf`) so Git keeps shell scripts Unix-safe.

**Workaround on EC2 without pulling fixes:**

```bash
perl -pi -e 's/\r\n/\n/g' ~/fyp_crop_disease/infra/scripts/*.sh
```

### 2.2 Backend startup and memory (t3.micro)

Model bundles (**ONNX / Keras / PyTorch**) were loaded **at import time**, before Gunicorn could serve traffic. On small instances this often caused **out-of-memory (OOM)** kills and **`curl: Recv failure: Connection reset by peer`**.

**Fix:** Load models on a **background thread** after the app module loads:

- **`GET /api/health`** returns quickly with `"status": "loading_models"` until warmup finishes, then full sector details.
- **`POST /api/predict`** waits for models (or returns **503** if loading failed).

Dockerfile tweak: Gunicorn **`--threads`** reduced from **4** to **2** to lower RAM use.

### 2.3 Deploy script health check

The deploy script now **retries** `/api/health` for several minutes instead of a single immediate `curl`, matching slow first-time model load.

### 2.4 Terraform / AMI / subnet notes (already in codebase)

- Prefer **non-minimal** Amazon Linux 2023 AMI so SSH / tooling behave predictably.
- Avoid placing **`t3.micro`** in **`us-east-1e`** (capacity/sku constraints).
- Optional **`key_name`** for SSH with a `.pem` key pair.

---

## 3. How to upload and run on AWS

### Step A — Prerequisites (on your laptop)

1. AWS account and credentials (`aws configure` or environment variables).
2. [Terraform](https://developer.hashicorp.com/terraform/install) installed (≥ 1.5).
3. An EC2 **key pair** in the target region (e.g. name `fyp`, download `fyp.pem`).
4. This repository (or your fork) pushed to GitHub with branches/files needed on the server (e.g. `aws-upload`).

### Step B — Provision infrastructure

```bash
cd infra/terraform
terraform init
terraform apply
```

Set variables as needed, for example in `terraform.tfvars`:

- `key_name = "fyp"`
- `instance_type = "t3.micro"` (upgrade if builds or inference OOM)
- Tighten `ssh_cidr` to your IP instead of `0.0.0.0/0` when possible.

Note Terraform outputs:

- **`elastic_ip`** — public IP for the API.
- **`api_base_url`** — e.g. `http://<elastic_ip>:5020`.

### Step C — Upload code to EC2 (“upload” options)

**Option 1 — Git clone (recommended)**

SSH into the instance:

```bash
ssh -i /path/to/fyp.pem ec2-user@<ELASTIC_IP>
```

Clone the repo (match your actual URL and branch):

```bash
cd ~
git clone -b aws-upload https://github.com/<your-org>/<your-repo>.git fyp_crop_disease
cd fyp_crop_disease
```

**Option 2 — Copy from laptop**

```bash
rsync -avz -e "ssh -i /path/to/fyp.pem" \
  ./Crops-Disease-Prediction-App-Using-ReactJS-and-Flask-/ \
  ec2-user@<ELASTIC_IP>:~/fyp_crop_disease/
```

Ensure these paths exist on the server (Docker build expects them):

- `backend/`
- `FYP_PlantDisease/`
- `crop leaves  2nd models saved/`

### Step D — Build and run Docker on EC2

```bash
cd ~/fyp_crop_disease
sudo bash infra/scripts/deploy-backend-docker-on-ec2.sh
```

This builds `crop-api:latest` and runs container **`crop-api`** with restart policy **`unless-stopped`**.

### Step E — Verify

On the instance:

```bash
curl -sS "http://127.0.0.1:5020/api/health" | python3 -m json.tool
```

From your laptop (confirms security group + Elastic IP):

```bash
curl -sS "http://<ELASTIC_IP>:5020/api/health"
```

Expect `"ok": true` and eventually **`"model_loaded": true`** for both sectors.

### Step F — Point the mobile app

Set the API base URL (example for Expo):

```text
EXPO_PUBLIC_API_URL=http://<ELASTIC_IP>:5020
```

Use **`http://`** unless you add HTTPS (ALB + ACM, CloudFront, etc.).

---

## 4. Operational commands

| Task | Command |
|------|---------|
| Container logs | `sudo docker logs -f crop-api` |
| Restart after code change | Re-run `sudo bash infra/scripts/deploy-backend-docker-on-ec2.sh` |
| Stop container | `sudo docker stop crop-api` |

---

## 5. Troubleshooting quick reference

| Symptom | Likely cause | What to try |
|---------|----------------|-------------|
| `set: pipefail` / invalid option | CRLF in `.sh` files | `perl -pi -e 's/\r\n/\n/g' infra/scripts/*.sh` or pull LF-fixed branch |
| Connection reset / empty curl right after deploy | OOM during model load | Upgrade instance (e.g. `t3.small`+); check `docker logs` |
| Health shows `loading_models` for a long time | Large models / CPU | Wait; first load is slow |
| Health `model_load_failed` | Import or path error | `sudo docker logs crop-api` |
| SSH host key warning after replace | New instance, same EIP | `ssh-keygen -R <ELASTIC_IP>` |

---

## 6. Security reminders

- Restrict **`ssh_cidr`** in Terraform to your IP where possible.
- Do **not** commit **`*.pem`** keys (they should stay in `.gitignore`).
- Rotate **`FLASK_SECRET_KEY`**, **`JWT_SECRET_KEY`**, and OAuth/email credentials for anything beyond class demos.

---

## 7. Related files

| Path | Purpose |
|------|---------|
| `infra/terraform/` | EC2, EIP, security group |
| `infra/docker/Dockerfile.backend` | Backend image |
| `infra/scripts/deploy-backend-docker-on-ec2.sh` | Build + run container |
| `infra/README.md` | APK build + Android setup on EC2 |
| `backend/app.py` | API, lazy model warmup |

---

*Generated as a deployment report for the Crop Disease Prediction stack (Flask + Docker + AWS EC2).*
