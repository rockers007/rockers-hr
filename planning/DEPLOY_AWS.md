# Deploy Rockers HR to AWS EC2 at `hr.rockerstech.com`

This is a copy-pasteable walkthrough for standing up the full stack
(frontend + backend + Postgres + nginx + Let's Encrypt SSL) on a single
AWS EC2 instance, reachable at `https://hr.rockerstech.com`.

Everything under `infrastructure/oci/` was written to be cloud-agnostic —
docker-compose, the nginx config, the deploy/backup/restore scripts —
so the same files ship straight to EC2. The only AWS-specific pieces
are how you provision the VM, the security group, and the Elastic IP.

---

## 1. Cost + sizing summary

| Item | Recommended | Monthly cost (approx.) |
|---|---|---|
| EC2 instance | **t3.small** (2 vCPU, 2 GB RAM) | $15 |
| EBS root volume | 30 GB gp3 | $2.40 |
| Elastic IP (attached) | 1 | $0.00 |
| Data transfer out | ~10 GB/mo | $0.90 |
| **Total** | | **~$18/month** |

- Start with **t3.small**. If the backend (NestJS + Postgres) gets tight on RAM under load, resize to **t3.medium** (4 GB) in-place — takes 2 minutes and requires only a reboot.
- **Do not** use `t3.micro` (1 GB RAM). The NestJS `nest build` step OOM-kills at 1 GB.
- If you keep the free-tier eligible for the first 12 months, `t2.micro` (1 vCPU, 1 GB) is free — but the caveat above applies.

---

## 2. AWS EC2 provisioning

### 2.1 Create the instance

1. **AWS Console → EC2 → Instances → Launch instances**
2. **Name:** `rockers-hr-prod`
3. **AMI:** Ubuntu Server 24.04 LTS (HVM, SSD Volume Type) — 64-bit (x86)
4. **Instance type:** `t3.small`
5. **Key pair:**
   - Click **Create new key pair**
   - Name: `rockers-hr-prod`
   - Type: RSA, Format: `.pem`
   - **Download it and save to `~/.ssh/rockers-hr-prod.pem`**
   - `chmod 400 ~/.ssh/rockers-hr-prod.pem` (Linux/Mac). Windows: right-click → Properties → Security → remove all permissions except your user → Read-only.
6. **Network settings:**
   - VPC: default (or your existing VPC)
   - Auto-assign public IP: **Enable** (you'll replace it with an Elastic IP in step 2.3)
   - **Firewall (security group)** → click **Create security group**:
     - Name: `rockers-hr-prod-sg`
     - Rules:

       | Type | Protocol | Port | Source | Description |
       |---|---|---|---|---|
       | SSH | TCP | 22 | **My IP** (not `0.0.0.0/0`) | Admin SSH |
       | HTTP | TCP | 80 | `0.0.0.0/0` + `::/0` | Let's Encrypt challenges + HTTPS redirect |
       | HTTPS | TCP | 443 | `0.0.0.0/0` + `::/0` | Public traffic |

7. **Storage:** 30 GB gp3, root volume. Delete on termination = yes.
8. **Advanced details → User data:** leave blank for now (we'll bootstrap in step 3).
9. **Launch instance.**

### 2.2 Allocate an Elastic IP

Public IPs on EC2 change on stop/start. Attach an Elastic IP so DNS never needs to be updated:

1. **EC2 → Network & Security → Elastic IPs → Allocate Elastic IP address**
2. Public IPv4 address pool: Amazon's pool. **Allocate.**
3. Select the new EIP → **Actions → Associate Elastic IP address**
4. Instance: `rockers-hr-prod`. **Associate.**
5. **Write down this IP** — you'll use it in step 3 for DNS.

**Cost gotcha**: an Elastic IP is free *while attached to a running instance*. If you stop the instance and leave the EIP allocated, AWS charges $3.60/month for the reservation. Either keep the instance running or release the EIP when tearing down.

### 2.3 SSH in for the first time

```bash
ssh -i ~/.ssh/rockers-hr-prod.pem ubuntu@<your-elastic-ip>
```

You should land on the Ubuntu prompt. If you can't connect: check the security group has your IP on port 22, verify the key pair permissions are 400 on Linux/Mac.

---

## 3. DNS at HostGator — point `hr.rockerstech.com` at the EIP

Because your zone lives at HostGator, we add the record there (rather than creating a Route 53 hosted zone). This keeps DNS simple and doesn't cost anything extra.

1. Log in to **HostGator cPanel** for `rockerstech.com`.
2. **Domains → Zone Editor** (or **Advanced Zone Editor** on older cPanel).
3. Find `rockerstech.com`, click **Manage**.
4. **Add Record**:
   - **Type:** `A`
   - **Name:** `hr` (this will resolve to `hr.rockerstech.com` — HostGator appends the base domain automatically)
   - **TTL:** `300` (5 minutes) while you're setting things up. Raise to `3600` once stable.
   - **Address / Record:** `<your-elastic-ip>`
5. **Save.**

Verify propagation from your local machine:

```bash
# Linux / Mac
dig +short hr.rockerstech.com

# Windows PowerShell
Resolve-DnsName hr.rockerstech.com -Type A
```

Should return the EIP within 5 minutes. If it doesn't, wait — HostGator sometimes takes up to 30 minutes on new records.

**Optional AAAA (IPv6):** if you allocated an IPv6 Elastic IP too, add an `AAAA` record with the same name. Not required.

---

## 4. Bootstrap the server (Docker + firewall + swap)

SSH in and run this once. It installs Docker, sets up the firewall, adds a swap file (helps t3.small handle Node build spikes), and prepares the app directory.

```bash
#!/usr/bin/env bash
set -euo pipefail

# 4.1 System updates
sudo apt-get update
sudo apt-get upgrade -y

# 4.2 Docker + docker-compose plugin (official Docker repo, not the outdated
#     docker.io from Ubuntu's default repos)
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

# 4.3 Let the ubuntu user run docker without sudo. Logout+in after this.
sudo usermod -aG docker ubuntu

# 4.4 UFW firewall — defense in depth on top of the EC2 security group.
sudo ufw allow 22/tcp comment 'ssh'
sudo ufw allow 80/tcp comment 'http'
sudo ufw allow 443/tcp comment 'https'
sudo ufw --force enable

# 4.5 Swap file. t3.small has 2 GB RAM. Nest builds spike briefly; a 2 GB
#     swap saves you from OOM kills during npm install / next build.
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# 4.6 App directory
sudo mkdir -p /opt/rockers-hr
sudo chown ubuntu:ubuntu /opt/rockers-hr

echo "Bootstrap complete. Log out and back in so the docker group takes effect."
```

Save this as `bootstrap.sh` locally, `scp` it up, and run it:

```bash
scp -i ~/.ssh/rockers-hr-prod.pem bootstrap.sh ubuntu@<eip>:~
ssh -i ~/.ssh/rockers-hr-prod.pem ubuntu@<eip> 'bash ~/bootstrap.sh'
```

Then re-SSH so the `docker` group takes effect:

```bash
ssh -i ~/.ssh/rockers-hr-prod.pem ubuntu@<eip>
docker ps    # should print an empty table without "permission denied"
```

---

## 5. Copy the repo + configure

### 5.1 Clone

On the EC2 instance:

```bash
cd /opt/rockers-hr
git clone https://github.com/rockers007/rockers-hr.git .
git checkout main    # or payroll — whichever branch you deploy
```

### 5.2 Production environment file

Create `/opt/rockers-hr/.env.production`. Do **not** commit this to git.

```env
# -------- Domain --------
DOMAIN=hr.rockerstech.com
LETSENCRYPT_EMAIL=you@rockerstech.com          # for expiry warnings

# -------- Postgres --------
# Two ways: (A) inline Postgres via docker-compose  (B) external Supabase
# For (A):
POSTGRES_DB=rockers_hr
POSTGRES_USER=rockers
POSTGRES_PASSWORD=<generate-with: openssl rand -base64 32>
DATABASE_URL=postgresql://rockers:<same-password>@postgres:5432/rockers_hr

# For (B) — use the Supabase session-mode pooler URL instead:
# DATABASE_URL=postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres

# -------- Backend --------
NODE_ENV=production
API_PORT=4000
JWT_SECRET=<generate-with: openssl rand -base64 48>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://hr.rockerstech.com

# -------- Frontend (Next.js) --------
NEXT_PUBLIC_API_URL=https://hr.rockerstech.com

# -------- AWS S3 (uploads) --------
AWS_ACCESS_KEY_ID=<paste>
AWS_SECRET_ACCESS_KEY=<paste>
AWS_REGION=ap-south-1
AWS_S3_BUCKET=<your-bucket>
AWS_CLOUDFRONT_URL=                             # optional

# -------- SMTP (invite emails, notifications) --------
SMTP_HOST=smtp.hostgator.com                    # or your provider
SMTP_PORT=465
SMTP_USER=hr@rockerstech.com
SMTP_PASS=<paste>
SMTP_FROM="Rockers HR <hr@rockerstech.com>"

# -------- Google (calendar sync + legacy Google login) --------
GOOGLE_CLIENT_ID=<paste>
GOOGLE_CLIENT_SECRET=<paste>
GOOGLE_CALLBACK_URL=https://hr.rockerstech.com/api/v1/auth/google/callback

# -------- Optional: enable managed-Postgres SSL if using Supabase/RDS --------
# PGSSL=require
```

Generate the secrets in one command:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 48)"
```

Paste the outputs into the file. **Do not** reuse defaults.

Lock permissions:

```bash
chmod 600 /opt/rockers-hr/.env.production
```

---

## 6. First deploy — build + start the stack

The docker-compose file at `infrastructure/oci/docker-compose.production.yml` and the nginx config at `infrastructure/oci/nginx/conf.d/default.conf` are the ones you'll use. They're cloud-agnostic — no OCI-specific bits.

### 6.1 Render the nginx config with your domain

The nginx template has `DOMAIN_PLACEHOLDER` sprinkled throughout. Replace it:

```bash
cd /opt/rockers-hr
sed -i "s/DOMAIN_PLACEHOLDER/hr.rockerstech.com/g" \
    infrastructure/oci/nginx/conf.d/default.conf
```

### 6.2 Bring up the stack (HTTP only, first pass)

We start without TLS so certbot can complete the ACME HTTP-01 challenge on port 80. This is a two-step:

```bash
cd /opt/rockers-hr
docker compose -f infrastructure/oci/docker-compose.production.yml \
    --env-file .env.production \
    up -d --build
```

This will:
1. Build the frontend + backend images (~5 minutes the first time; subsequent rebuilds are fast thanks to layer caching).
2. Start postgres, backend, frontend, and nginx.
3. Run pending TypeORM migrations on backend startup.

Watch the logs:

```bash
docker compose -f infrastructure/oci/docker-compose.production.yml logs -f
```

You should see:
- `postgres`: `database system is ready to accept connections`
- `backend`: `Rockers HR API running on port 4000`
- `frontend`: `Ready started server on 0.0.0.0:3000`
- `nginx`: no errors

Ctrl-C to stop tailing (containers keep running).

Verify port 80 is serving something:

```bash
curl -I http://hr.rockerstech.com
# Should return `HTTP/1.1 301 Moved Permanently` with Location: https://...
```

If you get a connection refused, check the EC2 security group has port 80 open from `0.0.0.0/0`.

---

## 7. SSL certificate via Let's Encrypt

The docker-compose file already includes a `certbot` service. Run it once to obtain the initial cert:

```bash
cd /opt/rockers-hr
docker compose -f infrastructure/oci/docker-compose.production.yml \
    --env-file .env.production \
    run --rm certbot certonly \
    --webroot -w /var/www/certbot \
    -d hr.rockerstech.com \
    --email you@rockerstech.com \
    --agree-tos --no-eff-email
```

On success, certbot writes the cert into a shared volume that nginx picks up. Reload nginx:

```bash
docker compose -f infrastructure/oci/docker-compose.production.yml \
    exec nginx nginx -s reload
```

Verify HTTPS:

```bash
curl -I https://hr.rockerstech.com
# Should return `HTTP/2 200` (or 301 to a default route)
```

Test the API:

```bash
curl -I https://hr.rockerstech.com/api/v1/health
# Should return 200 OK
```

Open `https://hr.rockerstech.com` in a browser — you should see the login page with a valid green padlock.

### 7.1 Auto-renewal

Let's Encrypt certs expire every 90 days. Set up a cron on the host that renews and reloads nginx:

```bash
# Edit ubuntu's crontab
crontab -e
```

Add this line:

```
0 3 * * * cd /opt/rockers-hr && docker compose -f infrastructure/oci/docker-compose.production.yml run --rm certbot renew --quiet && docker compose -f infrastructure/oci/docker-compose.production.yml exec nginx nginx -s reload >> /var/log/certbot-renew.log 2>&1
```

Runs at 3 AM daily. Renewal is a no-op if the cert has more than 30 days left, so it's cheap.

Test the renewal now (dry run):

```bash
cd /opt/rockers-hr
docker compose -f infrastructure/oci/docker-compose.production.yml \
    run --rm certbot renew --dry-run
```

---

## 8. Post-deploy checks

Run through this list. If everything passes, you're live.

- [ ] `https://hr.rockerstech.com/` loads the login page with a valid padlock
- [ ] `curl -I https://hr.rockerstech.com/api/v1/health` returns 200
- [ ] Log in as the admin (`admin@rockersinfo.com` / seeded password), immediately **rotate that password**
- [ ] Invite a test employee, confirm they receive the email
- [ ] Upload a document — verifies S3 CORS (see §12)
- [ ] Trigger a payslip preview — verifies PDF generation
- [ ] Check `docker compose ... logs backend` for any startup warnings

---

## 9. Deploy updates (day-to-day)

Once set up, redeploying is a two-command loop:

```bash
ssh -i ~/.ssh/rockers-hr-prod.pem ubuntu@<eip>
cd /opt/rockers-hr && bash infrastructure/oci/scripts/deploy.sh
```

That script (from `infrastructure/oci/scripts/deploy.sh`) does:
1. `git pull`
2. `docker compose build --pull`
3. `docker compose up -d` (rolling restart)
4. Prints the git SHA that's now running

Downtime during redeploy is ~10–15 seconds (frontend + backend restart sequentially). Zero-downtime blue/green is possible but adds complexity — skip until your traffic warrants it.

---

## 10. Database backups

The stack embeds Postgres in the same VM, so back up regularly:

```bash
# Manual one-off
bash /opt/rockers-hr/infrastructure/oci/scripts/backup.sh

# Scheduled: every day at 2 AM, keep 14 days
sudo crontab -e
# Add:
0 2 * * * /opt/rockers-hr/infrastructure/oci/scripts/backup.sh > /var/log/pg-backup.log 2>&1
```

Backups land in `/opt/rockers-hr/backups/`. Copy them off-box weekly to an S3 bucket:

```bash
aws s3 sync /opt/rockers-hr/backups s3://rockers-hr-backups/ --delete
```

Restore procedure is documented in `infrastructure/oci/scripts/restore.sh`.

---

## 11. Monitoring / observability essentials

For a single-VM deploy the minimum you should have:

1. **CloudWatch alarms** on the EC2 instance:
   - CPU > 80% for 15 min
   - StatusCheckFailed = 1 for 5 min
   - EBS disk usage > 85% (requires CloudWatch agent)
2. **Uptime check** — a free UptimeRobot or BetterUptime monitor hitting `https://hr.rockerstech.com/api/v1/health` every 5 min, alerting on 3 consecutive failures.
3. **Log tailing** for the first week:
   ```bash
   docker compose -f infrastructure/oci/docker-compose.production.yml logs -f backend
   ```

---

## 12. S3 CORS for direct-from-browser uploads

You already hit this once during Vercel testing — the frontend PUTs files directly to S3 using a presigned URL, so the bucket needs CORS to allow the browser origin. In S3 Console → your bucket → **Permissions → Cross-origin resource sharing (CORS)** → Edit:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD", "POST"],
    "AllowedOrigins": [
      "https://hr.rockerstech.com",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag", "x-amz-request-id", "x-amz-id-2"],
    "MaxAgeSeconds": 3000
  }
]
```

Without this the profile page's document/photo/resume upload will fail with "Failed to fetch".

---

## 13. Security hardening (do these next)

Ship the deploy first, then tighten:

- [ ] **Disable password SSH** — key-only. Edit `/etc/ssh/sshd_config`: `PasswordAuthentication no`. Restart sshd.
- [ ] **Fail2ban** on SSH: `sudo apt install fail2ban && sudo systemctl enable --now fail2ban`.
- [ ] **Restrict SSH source** to your office VPN or a bastion. Update the security group's port 22 source from "My IP" to a `/32` you know is stable.
- [ ] **Rotate the default admin password** on first login (the seeder ships `admin123`).
- [ ] **AWS IAM** — create a dedicated IAM user for the S3 keys used above, with permissions scoped to `s3:PutObject / s3:GetObject / s3:DeleteObject` on your specific bucket only. Don't reuse the root account keys.
- [ ] **Enable S3 bucket policy** to require SSL (`aws:SecureTransport = true`).
- [ ] **Turn on CloudTrail** in the AWS account for audit.
- [ ] **Consider AWS Systems Manager Session Manager** for browser-based SSH — you can close port 22 to the internet entirely.

---

## 14. Rollback plan

If a deploy misbehaves:

```bash
cd /opt/rockers-hr
git log --oneline -5              # find the previous good SHA
git checkout <previous-sha>
bash infrastructure/oci/scripts/deploy.sh
```

For a bad migration, restore from the latest backup:

```bash
bash infrastructure/oci/scripts/restore.sh /opt/rockers-hr/backups/<YYYY-MM-DD>.sql.gz
```

---

## 15. Common gotchas

| Symptom | Likely cause | Fix |
|---|---|---|
| `hr.rockerstech.com` resolves but nginx returns 502 | Backend container failed to start | `docker compose logs backend` — usually missing env var |
| Login returns "Failed to fetch" | `NEXT_PUBLIC_API_URL` mismatch | Set to `https://hr.rockerstech.com` (no trailing slash) and rebuild |
| Login accepted but immediate 401 on next request | JWT `tokens_valid_from` clock skew | Ensure `chrony` is running on the VM |
| Certbot fails with "unauthorized" | Port 80 not reachable from the internet | Verify EC2 security group + UFW allow 80 |
| Certbot fails with "DNS problem" | HostGator record hasn't propagated | `dig +short hr.rockerstech.com` — wait until it returns the EIP |
| Document/photo upload gets CORS error | S3 bucket CORS missing | Apply the JSON from §12 |
| Admin invite email never arrives | SMTP creds wrong or Render/EC2 blocks outbound 465 | Check backend logs for `Failed to send user.invited` |
| EC2 instance stops responding | RAM exhaustion during a Node build | Confirm swap is on (`swapon --show`), consider t3.medium |

---

## 16. TL;DR checklist

1. Launch t3.small Ubuntu 24.04 EC2 with security group opening 22/80/443.
2. Allocate + associate an Elastic IP.
3. HostGator cPanel: add `hr` A record → EIP.
4. SSH in, run the bootstrap script from §4.
5. `git clone` the repo into `/opt/rockers-hr`.
6. Write `.env.production` with real secrets (§5.2).
7. `sed` the nginx template to insert your domain.
8. `docker compose up -d --build` — stack starts on port 80.
9. Run certbot to obtain TLS cert. Reload nginx.
10. Open `https://hr.rockerstech.com` — should show login page with padlock.
11. Add cron for cert renewal (§7.1) and daily DB backup (§10).
12. Apply S3 CORS (§12).
13. Rotate default admin password.

---

*The scripts under `infrastructure/oci/` are cloud-agnostic despite the folder name — you can either use them as-is or rename the folder to `infrastructure/vm/` for clarity. Nothing in the docker-compose or nginx config depends on OCI-specific features.*
