# deploy-secrets.ps1
# Automates the creation of GCP Secret Manager secrets from .env.local

$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Error ".env.local file not found!"
    exit 1
}

# List of secrets required by cloudbuild.yaml
$requiredSecrets = @(
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "GEMINI_API_KEY",
    "MAPS_API_KEY",
    "FIREBASE_SERVICE_ACCOUNT_JSON"
)

Write-Host "Reading secrets from $envFile..." -ForegroundColor Cyan

# Parse .env.local (simple parser for KEY=VALUE)
$envData = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#\s][^=]*)\s*=\s*(.*)$') {
        $key = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        # Remove quotes if present
        if ($value -match '^"(.*)"$') { $value = $Matches[1] }
        elseif ($value -match "^'(.*)'$") { $value = $Matches[1] }
        $envData[$key] = $value
    }
}

foreach ($secretName in $requiredSecrets) {
    if (-not $envData.ContainsKey($secretName)) {
        Write-Warning "Missing $secretName in .env.local. Skipping..."
        continue
    }

    $secretValue = $envData[$secretName]
    
    Write-Host "Processing secret: $secretName" -ForegroundColor Yellow

    # Check if secret exists
    $exists = gcloud secrets list --filter="name ~ $secretName" --format="value(name)"
    
    if (-not $exists) {
        Write-Host "Creating secret $secretName..."
        gcloud secrets create $secretName --replication-policy="automatic"
    } else {
        Write-Host "Secret $secretName already exists."
    }

    # Add new version
    Write-Host "Adding new version for $secretName..."
    $secretValue | gcloud secrets versions add $secretName --data-file=-
}

Write-Host "Success! All secrets synced to GCP Secret Manager." -ForegroundColor Green
