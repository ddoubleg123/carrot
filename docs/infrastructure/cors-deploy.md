# GCS/Firebase Storage CORS Deployment (CI)

This repository includes a GitHub Actions workflow to apply a CORS configuration to a Firebase Storage bucket from `firebase-cors.json`.

## Files
- `firebase-cors.json` — Source of truth for allowed origins/methods/headers.
- `.github/workflows/deploy-cors.yml` — Manual workflow to apply and verify CORS.

## Required GitHub Secrets
Configure these repository secrets:
- `GCP_PROJECT_ID` — GCP project ID (e.g., `involuted-river-466315-p0`).
- `GCP_WORKLOAD_IDP` — Workload Identity Federation provider resource, e.g.:
  - `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`
- `GCP_SERVICE_ACCOUNT_EMAIL` — Service account email with `Storage Admin` (or granular `storage.buckets.update`) permissions, e.g. `ci-deployer@PROJECT_ID.iam.gserviceaccount.com`.

Alternative: use `GCP_SA_KEY_JSON` instead of WIF (not recommended). If you choose that path, modify the workflow to pass `service_account_key` to `google-github-actions/auth` and remove WIF inputs.

## Running the workflow
1. Go to GitHub → Actions → `Deploy GCS CORS`.
2. Click `Run workflow`.
3. Inputs:
   - `bucket`: Your bucket name, e.g. `involuted-river-466315-p0.firebasestorage.app`.
   - `corsFile` (optional): Path to CORS JSON, default `firebase-cors.json`.
4. The job will:
   - Authenticate to Google Cloud via OIDC (WIF).
   - Run `gsutil cors set` and `gsutil cors get` for verification.

## Local alternative
If you need to run locally:
```
# Install Cloud SDK: https://cloud.google.com/sdk/docs/install
gcloud init
gcloud auth application-default login

# Apply CORS
gsutil cors set firebase-cors.json gs://<bucket>

# Verify
gsutil cors get gs://<bucket>
```

## Notes
- Keep CORS minimal: only production origins, methods [GET, PUT, HEAD, OPTIONS], and minimal response headers (e.g., `Content-Type`).
- Maintain separate dev/staging/prod CORS if needed; store additional files like `firebase-cors.dev.json`.
- Signed URL uploads bypass Firebase Storage Rules; authorization is enforced server-side by URL issuance and path scoping.
