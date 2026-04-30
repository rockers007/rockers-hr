# Deploying Rockers HR on Oracle Cloud Infrastructure

End-to-end runbook for getting the production stack live on a single
OCI VM. Designed for the **Always Free tier** — Ampere A1 VM (4 OCPU,
24 GB RAM) + 200 GB block storage + Object Storage. Sufficient for
< 500 employees with comfortable headroom. An upgrade path to managed
PostgreSQL + load balancer + multiple instances is documented at the
end.

> **Estimated time end-to-end: 60–90 minutes**, most of which is OCI
> account setup + DNS propagation. Actual deploy is ~10 min.

---

## Architecture

```
                 ┌────────────────────────────────────────────────┐
                 │  OCI Compute (Ampere A1, 4 OCPU / 24 GB)       │
   Public        │                                                │
   Internet ──►  │  nginx :443  ──┬── frontend :3000  (Next.js)   │
                 │                └── backend  :4000  (NestJS)    │
                 │                                                │
                 │              postgres :5432 (volume: pgdata)   │
                 │              backup    (writes /opt/.../backups)│
                 └────────────────────────┬───────────────────────┘
                                          │ daily cron
                                          ▼
                               OCI Object Storage
                              ┌─────────────────────┐
                              │ rockers-hr          │ (uploads, photos, PDFs)
                              │ rockers-hr-backups  │ (pg_dump.sql.gz)
                              └─────────────────────┘
```

- **Single VM** runs the whole stack via docker compose.
- **No Postgres external port** — only the backend (same docker network) talks to it.
- **OCI Object Storage** holds user uploads + payslip PDFs + nightly backups via the S3-compatible API (zero code changes — just `AWS_S3_ENDPOINT` env var).
- **TLS** via Let's Encrypt, auto-renewed.
- **Outbound email** via your existing SMTP setup (Gmail / SendGrid).

Files referenced below live in `infrastructure/oci/` of this repo.

---

## 1. Prerequisites

| Need | Where |
|------|-------|
| OCI account | https://signup.oraclecloud.com — Always Free tier, no card charged |
| A registered domain | e.g. `hr.example.com` (any registrar) |
| GitHub access to the repo | for `git clone` on the VM |
| Existing SMTP credentials | Gmail App Password OR SendGrid API key |

You **don't** need: AWS account, Kubernetes, Terraform.

---

## 2. OCI account + tenancy walk-through

> Doing this once on a fresh OCI account.

1. **Sign up** at https://signup.oraclecloud.com.
2. Pick a home region close to your users (Mumbai = `ap-mumbai-1`, Hyderabad = `ap-hyderabad-1`, Singapore = `ap-singapore-1` for India / SE Asia).
3. After verification, log in to the OCI Console.
4. Top-right → **Profile** → **Tenancy: rockers-…** → write down the **Object Storage namespace** (you'll need it later). Also copy the **Tenancy OCID**.

### 2a. Create a non-root IAM user (do not use the tenancy admin for daily ops)

1. **Identity & Security → Domains → Default** → **Users** → **Create user**.
2. Fill `rockers-hr-ops` and your real email. Save.
3. Click the new user → **Groups** → assign to a new group `rockers-hr-admins`.
4. **Identity → Policies → Create Policy** in your compartment:
   ```
   Allow group rockers-hr-admins to manage all-resources in compartment rockers-hr-prod
   ```
   *(Create the compartment `rockers-hr-prod` first under Identity → Compartments if you haven't.)*
5. Set a password for the new user. Use it from now on.

---

## 3. Networking (VCN)

Use the OCI **Networking Quickstart** wizard for sane defaults — it creates a VCN with a public subnet, internet gateway, route table, and a security list in one click.

1. **Networking → Virtual Cloud Networks → Create VCN with Internet Connectivity**.
2. Name: `rockers-hr-vcn`, compartment: `rockers-hr-prod`. Submit.
3. After the VCN is up, click into the **public security list** (auto-created) and add ingress rules:

| Stateless | Source CIDR | Protocol | Source Port | Destination Port | Notes |
|---|---|---|---|---|---|
| No | `0.0.0.0/0` | TCP | All | **80** | HTTP (Let's Encrypt + redirect) |
| No | `0.0.0.0/0` | TCP | All | **443** | HTTPS (the app) |
| No | `<your-IP>/32` | TCP | All | **22** | SSH from your office IP only |

> **Don't** open 22 to the world. If your IP is dynamic, use OCI Bastion (free) for SSH access — see §10.

---

## 4. Provisioning the VM

1. **Compute → Instances → Create instance**.
2. Name: `rockers-hr-prod`.
3. **Image and shape**:
   - Image: **Oracle Linux 8** (recommended) or Ubuntu 22.04
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM) → 4 OCPU / 24 GB RAM
   *(this fits Always Free — total Ampere cap is 4 OCPU + 24 GB across all instances)*
4. **Networking** → use the VCN you just created, public subnet, **Assign a public IPv4 address: yes**.
5. **SSH keys** — paste your public key (`~/.ssh/id_ed25519.pub`).
6. **Boot volume size: 100 GB** (default 47 GB is tight once Docker images and pg data grow).
7. **Show advanced options** → **Cloud-Init** tab → paste the contents of `infrastructure/oci/cloud-init/bootstrap.yaml`. **This is mandatory** — it installs Docker, certbot, OCI CLI, and the cron entries on first boot.
8. **Create**.

After ~3 minutes the instance is `Running` and cloud-init has finished. Note the **public IP**.

---

## 5. DNS

1. Point `hr.example.com` → the VM's public IP at your DNS provider (an `A` record).
2. Wait until `dig hr.example.com +short` returns the public IP. Usually < 5 min, sometimes up to an hour.

> If you're using OCI's own DNS, do this under **Networking → DNS Management → Zones**.

---

## 6. Object Storage — buckets + S3 credentials

Two buckets:

- `rockers-hr` — user uploads (photos, resumes, documents, payslips)
- `rockers-hr-backups` — nightly pg dumps

### 6a. Create the buckets

1. **Object Storage → Buckets → Create bucket**.
2. Name: `rockers-hr`, compartment: `rockers-hr-prod`, **Standard tier**, **No public access** (we issue presigned URLs from the backend). Submit.
3. Repeat for `rockers-hr-backups`.

### 6b. Generate S3-compatible credentials

OCI lets the AWS SDK talk to Object Storage via "Customer Secret Keys".

1. **Identity & Security → Domains → Default → Users → rockers-hr-ops**.
2. Scroll to **Customer secret keys** → **Generate secret key**.
3. Name: `rockers-hr-s3`. Copy:
   - The displayed **Access key** (visible once)
   - The displayed **Secret key** (visible once — paste somewhere safe NOW)
4. The **endpoint** for your region is:
   ```
   https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
   ```
   Example for Mumbai: `https://bm0123abcdef.compat.objectstorage.ap-mumbai-1.oraclecloud.com`.
   Find your namespace at top of any bucket detail page.

You'll plug these into `.env.production` next.

### 6c. CORS on the upload bucket

The browser uploads files directly to Object Storage via presigned URLs, so the bucket needs CORS set so the PUT preflight succeeds.

1. **Buckets → rockers-hr → CORS** tab → **Edit**.
2. Add a rule:
   - **Allowed origins**: `https://hr.example.com`
   - **Allowed methods**: `PUT, GET, HEAD`
   - **Allowed headers**: `*`
   - **Exposed headers**: `ETag`
   - **Max age**: `3000` seconds

### 6d. Pre-authenticated request OR public-read for photos?

Profile photos render via `<img src>` from the browser — so the URL needs to work without auth. Two options:

- **Option A — Use presigned GET URLs.** Already supported in the codebase via `ProfileExtrasService.getDocumentViewUrl`. You'd extend it to photos. Slightly more work.
- **Option B — Make the photo prefix public-read.** Create a **Pre-Authenticated Request** at the bucket level scoped to the `profile_photo/` prefix with `Read` access. Set `AWS_CLOUDFRONT_URL` to the PAR URL. Easiest for the MVP.

The default in `.env.production.example` assumes Option B. Documents and payslips stay private.

---

## 7. First deploy

SSH into the VM:

```bash
ssh opc@<vm-public-ip>     # Oracle Linux
# or
ssh ubuntu@<vm-public-ip>  # Ubuntu
```

### 7a. Clone the repo

```bash
sudo git clone https://github.com/rockers007/rockers-hr.git /opt/rockers-hr
sudo chown -R $USER:$USER /opt/rockers-hr
cd /opt/rockers-hr
```

### 7b. Configure environment

```bash
cd infrastructure/oci
cp .env.production.example .env.production
chmod 600 .env.production
vim .env.production
```

Fill **every** value. Paste the AWS keys + endpoint from §6b. Generate `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

(Or `openssl rand -hex 32` if node isn't installed yet.)

### 7c. Run the deploy

```bash
sudo /opt/rockers-hr/infrastructure/oci/scripts/deploy.sh
```

The script:

1. Verifies docker, certbot, etc. (cloud-init installed them).
2. Renders nginx config with your domain.
3. Issues a TLS cert via Let's Encrypt (HTTP-01 challenge — port 80 must be reachable from the internet).
4. Builds backend + frontend images on the VM.
5. Brings the docker compose stack up.
6. Tails healthchecks until the backend is `healthy`.

Browse to `https://hr.example.com`. You should see the login page.

### 7d. First admin

The app ships with an admin user defined in `master_admin_roles` seed migrations, but no admin user is created in `admin_users` automatically. Either:

- **Run a seed**: `docker compose -f docker-compose.production.yml --env-file .env.production exec backend npm run seed:admin -- --email you@example.com --password 'TempPw123!'`
- **Or open psql** and insert manually:
  ```bash
  docker compose -f docker-compose.production.yml --env-file .env.production exec postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
  ```
  Then follow `planning/AUTH_REGISTRATION.md` §3 for the bcrypt-hash + insert pattern. Change the temporary password on first login.

---

## 8. Backups

Two-layer backup, both already wired:

| Layer | What | When | Retention |
|---|---|---|---|
| `backup` container | `pg_dump --gzip` to `/opt/rockers-hr/backups/` | Every 24h | 30 days local |
| Cron `backup.sh` | Uploads the latest dump to the `rockers-hr-backups` bucket | 03:00 daily | 90 days off-box |

The cron entry was installed by cloud-init at `/etc/cron.d/rockers-hr-backup`. Verify with `cat /etc/cron.d/rockers-hr-backup`.

### Configure OCI CLI for the upload step

`backup.sh` uses `oci os object put`. The CLI needs `~/.oci/config` for the user that owns the cron job (root, by default).

```bash
sudo oci setup config
```

Answer the prompts:
- User OCID (from §2a — the `rockers-hr-ops` user detail page)
- Tenancy OCID (top of OCI Console → Tenancy)
- Region (e.g. `ap-mumbai-1`)
- API key — let it auto-generate (saves to `~/.oci/`)

After it finishes, **upload the public key** at OCI Console → User → API keys → Add API key → paste the contents of `~/.oci/oci_api_key_public.pem`.

Test the wiring:

```bash
sudo oci os object list --bucket-name rockers-hr-backups
```

If that returns `[]` (or your existing list), you're good.

### Restore drill

```bash
sudo /opt/rockers-hr/infrastructure/oci/scripts/restore.sh latest        # latest local
sudo /opt/rockers-hr/infrastructure/oci/scripts/restore.sh oci://rockers_hr_20260501_030000.sql.gz   # from bucket
```

Run the drill **once a month**. A backup you've never restored from is not a backup.

---

## 9. Updates

```bash
cd /opt/rockers-hr
sudo git pull
sudo /opt/rockers-hr/infrastructure/oci/scripts/deploy.sh --pull
```

`deploy.sh --pull` rebuilds the images, applies migrations on container startup (the backend's `docker-entrypoint.sh` runs `typeorm migration:run` first), and rolls the containers. Docker keeps the old containers around for ~30 seconds in case the new ones fail health checks.

---

## 10. SSH access via OCI Bastion (free, no port 22 open to internet)

Skip if your IP is static and you've already added it to the security list.

1. **Identity & Security → Bastion → Create bastion** in the same VCN.
2. Subnet: a private subnet in the same VCN (or the public one — it's just where the bastion sits).
3. **CIDR allow-list**: `0.0.0.0/0` (the bastion enforces ephemeral, signed sessions — much safer than open SSH).
4. Once active, **Bastion → Sessions → Create session**, type **Managed SSH**, target the VM. Copy the SSH command it generates and paste into your terminal.

You can now close port 22 in the security list entirely.

---

## 11. Monitoring + alerts

### Logs

`docker compose -f docker-compose.production.yml --env-file .env.production logs -f` for live tail. The compose file caps log rotation at 100 MB per service (5 × 20 MB) so the disk doesn't fill up.

For shipped logs, install the OCI logging agent (free):
```bash
sudo dnf install -y unified-monitoring-agent
sudo unified-monitoring-agent register
```
Then in the OCI Console enable log groups and tail-readers per file.

### Metrics + alarms

OCI Monitoring is free. Pre-set alarms worth wiring:

- **CPU > 85% for 10 min** → email to ops
- **Memory > 90% for 10 min** → email
- **Boot volume free space < 20 GB** → email
- **Health-check fail** → trigger a small bash script that restarts the stack

Path: **Observability & Management → Monitoring → Alarms**.

---

## 12. Scaling — when the single VM stops being enough

Symptoms: sustained CPU > 70%, response times > 500 ms p50, postgres connections at the configured cap.

### Step 1 — vertical (cheapest)

Bump the VM shape to 6 OCPU / 36 GB RAM (still ARM). Reboot. Done.

### Step 2 — Postgres → managed

OCI launched **OCI Database with PostgreSQL** in 2024. Migrate:

1. Provision a managed PostgreSQL in the same VCN.
2. Export with `pg_dump` from the existing container.
3. Restore into the managed DB with `psql`.
4. Update `DATABASE_URL` in `.env.production` to the managed endpoint.
5. Remove the `postgres` and `backup` services from `docker-compose.production.yml` (managed DB has its own backups).
6. Redeploy.

### Step 3 — multi-instance

1. Create a second identical VM behind a Load Balancer (free LB — one OCPU equivalent).
2. The backend is stateless except for `tokens_valid_from` (stored in DB) — both VMs serve the same DB.
3. Object Storage is shared.
4. The only thing that needs a sticky session is the `useAutoRefresh` polling — it's stateless across requests, so no work needed.

---

## 13. Secrets management

For the MVP, secrets live in `.env.production` on the VM with `chmod 600`. That's fine when only ops users have SSH access.

For tighter posture, move them to **OCI Vault**:

1. **Identity & Security → Vault → Create vault**.
2. Inside, **Create master encryption key** (AES, 256-bit).
3. **Create secrets** — one secret per `.env` line.
4. Update `deploy.sh` to read each secret with `oci vault secret get-secret-bundle ...` and inject into the docker compose `--env` args.

Step 4 is ~30 lines of shell — write it once, never look at the `.env` file again.

---

## 14. Disaster recovery checklist

If the VM is gone or compromised, you should be able to rebuild in under an hour:

1. New VM via the OCI Console (cloud-init script attached) — 5 min.
2. SSH in, clone repo, fill `.env.production` (you have the secrets backed up somewhere safe — ideally Vault) — 10 min.
3. `oci setup config` — 5 min.
4. `./deploy.sh` — 10 min.
5. `./restore.sh oci://<latest-backup>` — 5 min for a small DB.
6. Update DNS to point at the new IP — 5 min + propagation.

Practice this. The first time you do it for real should not be in an actual outage.

---

## 15. What I haven't included (intentional)

- **Terraform / OpenTofu**: 70% of the work for a single-VM deploy is OCI account / IAM / DNS, none of which Terraform helps with much. If you grow to 3+ VMs or multiple environments, the `oci` provider + this guide as a reference is straightforward. I can add a `terraform/` module on request.
- **Kubernetes (OKE)**: overkill for a < 50 employee deployment. Defer until you have multiple services or a real auto-scaling need.
- **OCI WAF**: useful when you face the public internet; not required for an internal HR tool. Add later if attack traffic shows up in nginx logs.

---

## Quick reference — common ops

```bash
# tail all logs
docker compose -f /opt/rockers-hr/infrastructure/oci/docker-compose.production.yml \
   --env-file /opt/rockers-hr/infrastructure/oci/.env.production logs -f

# restart just the backend (e.g. after .env change)
docker compose -f ... restart backend

# manual pg shell
docker compose -f ... exec postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"

# manual backup right now (independent of cron)
docker compose -f ... exec backup /bin/sh -c \
   'PGPASSWORD=$$POSTGRES_PASSWORD pg_dump -h $$PGHOST -U $$POSTGRES_USER $$POSTGRES_DB | gzip > /backups/manual_$$(date +%Y%m%d_%H%M%S).sql.gz'

# manual TLS renewal (the cron handles this nightly)
sudo certbot renew --post-hook "docker exec $(docker ps -qf name=nginx) nginx -s reload"

# update the app + apply migrations
cd /opt/rockers-hr && sudo git pull && sudo ./infrastructure/oci/scripts/deploy.sh --pull
```

---

## Related docs

- [`SECURITY_GUIDELINES.md`](./SECURITY_GUIDELINES.md) — production security baseline.
- [`SECURITY_TODO.md`](./SECURITY_TODO.md) — open hardening backlog (some items are production-deploy concerns).
- [`SEMGREP.md`](./SEMGREP.md) — static analysis runs in CI; see semgrep.dev dashboard for findings.
