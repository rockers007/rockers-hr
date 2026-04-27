# Local Semgrep runner for Windows + Docker.
#
# Usage (from repo root):
#   pwsh ./scripts/semgrep-local.ps1
#
# Optional env:
#   SEMGREP_APP_TOKEN  — if set, runs `semgrep ci` and uploads findings
#                        to https://semgrep.dev/orgs/-/findings .
#                        If unset, runs `semgrep scan` with public
#                        rulesets only (no upload, no auth required).
#   SEMGREP_RULES      — override the default ruleset, e.g.
#                        "p/owasp-top-ten p/security-audit p/typescript".
#
# Outputs:
#   semgrep-report.json   — full findings, machine-readable
#   semgrep-report.sarif  — same findings in SARIF (opens in IDE / GitHub)
#   semgrep-report.txt    — human-readable summary
#
# Skip a noisy rule once with:
#   docker run … semgrep scan --exclude-rule generic.secrets.security.detected-aws-account-id …

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
    Write-Error "Run this from inside the rockers-hr git repo."
    exit 1
}

Write-Host "==> Repo: $repoRoot"

# Pull/refresh the image so we get the latest rule fixes.
docker pull semgrep/semgrep:latest | Out-Null

$dockerArgs = @(
    'run', '--rm',
    '-v', "$($repoRoot):/src",
    '-w', '/src'
)

if ($env:SEMGREP_APP_TOKEN) {
    Write-Host "==> SEMGREP_APP_TOKEN detected — running 'semgrep ci' (uploads findings)."
    $dockerArgs += @('-e', "SEMGREP_APP_TOKEN=$env:SEMGREP_APP_TOKEN")
    $cmd = @(
        'semgrep/semgrep:latest',
        'semgrep', 'ci',
        '--sarif', '--output=semgrep-report.sarif',
        '--json', '--json-output=semgrep-report.json'
    )
} else {
    Write-Host "==> No SEMGREP_APP_TOKEN — running local scan with public rulesets."
    $rules = if ($env:SEMGREP_RULES) {
        $env:SEMGREP_RULES -split '\s+'
    } else {
        @('p/owasp-top-ten', 'p/security-audit', 'p/typescript', 'p/nodejsscan', 'p/react')
    }
    $configArgs = @()
    foreach ($r in $rules) { $configArgs += @('--config', $r) }
    # Always include our project rules.
    $configArgs += @('--config', '.semgrep/rockers-hr.yml')

    $cmd = @('semgrep/semgrep:latest', 'semgrep', 'scan') +
           $configArgs +
           @(
             # Suppress known false-positive rules. njsscan's nosql_find_injection
             # assumes Mongoose; we're on TypeORM/Postgres so every match is wrong.
             '--exclude-rule=ajinabraham.njsscan.database.nosql_find_injection.node_nosqli_injection',
             '--exclude-rule=ajinabraham.njsscan.xss.xss_node.express_xss',
             '--json', '-o', 'semgrep-report.json',
             '--metrics=off'
           )
}

Write-Host "==> Running: docker $($dockerArgs -join ' ') $($cmd -join ' ')"
docker @dockerArgs @cmd
$scanExit = $LASTEXITCODE

# A non-zero exit can mean either "findings detected" (with
# --error in CI mode) or "scan failed". For now we accept both 0 and 1.
if ($scanExit -gt 1) {
    Write-Error "semgrep failed with exit code $scanExit"
    exit $scanExit
}

if (Test-Path "$repoRoot/semgrep-report.json") {
    $count = (Get-Content "$repoRoot/semgrep-report.json" | ConvertFrom-Json).results.Count
    Write-Host "==> Done. $count finding(s) written to:"
    Write-Host "       $repoRoot/semgrep-report.sarif  (open in VS Code with the SARIF extension)"
    Write-Host "       $repoRoot/semgrep-report.json   (machine-readable)"
}
