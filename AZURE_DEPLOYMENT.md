# Azure Deployment Guide

This project is deployed to Azure as a **custom container**:

- **Azure App Service** runs the application
- **Azure Container Registry (ACR)** stores the Docker image
- **GitHub Actions** builds and deploys the app whenever code is pushed to `main`

This guide documents the exact deployment setup used for this repo.

## Architecture

```text
GitHub push to main
        │
        ▼
GitHub Actions workflow
        │
        ├─ builds Docker image for linux/amd64
        ├─ pushes image to Azure Container Registry
        └─ deploys image to Azure Web App
                │
                ▼
        Azure App Service serves the app
```

## Azure Resources Used

- Resource Group: `opg-weather-rg`
- Azure Container Registry: `opgweatherrushiacr`
- Azure Web App: `opg-weather-rushi`

## Production URL

Current Azure default URL:

```text
https://opg-weather-rushi-fqa8bwfrhnfdbef8.eastus-01.azurewebsites.net
```

If you do not own a custom domain yet, keep using the Azure-provided URL.

## Prerequisites

Before deploying:

- Azure account
- GitHub repository
- Docker working locally
- Azure CLI installed locally if you need to push/test images manually

## Local Validation Before Deploying

Run these first:

```bash
npm test
npm run build
docker compose up --build
```

If local build or local Docker fails, Azure deployment will usually fail too.

## Docker Notes

This app is deployed as a container. Azure App Service expects a Linux container image.

When building from an Apple Silicon Mac, use `linux/amd64` for Azure compatibility:

```bash
docker buildx build --platform linux/amd64 -t opgweatherrushiacr.azurecr.io/opg-weather-app:latest --push .
```

The GitHub Actions workflow already does this automatically.

## Azure App Service Configuration

The Web App is configured to run:

- Registry: `opgweatherrushiacr`
- Image: `opg-weather-app`
- Port: `3000`

Environment variables set in Azure:

- `NODE_ENV=production`
- `LOG_LEVEL=info`

These are configured in:

`Azure Portal -> Web App -> Settings -> Environment variables`

## GitHub Actions Deployment

The deployment workflow lives in:

- [`.github/workflows/azure-deploy.yml`](.github/workflows/azure-deploy.yml)

It triggers on pushes to `main`.

### Current Trigger

```yaml
on:
  push:
    branches:
      - main
```

That means:

- pushes to `main` deploy automatically
- pushes to feature branches do not deploy
- the normal pattern is: work on a branch, merge to `main`, Azure deploys from there

## Required GitHub Secrets

Configured in:

`GitHub -> Repo -> Settings -> Secrets and variables -> Actions`

Required secrets:

- `AZURE_ACR_NAME`
- `AZURE_WEBAPP_NAME`
- `AZURE_WEBAPP_PUBLISH_PROFILE`
- `REGISTRY_USERNAME`
- `REGISTRY_PASSWORD`

### Secret Details

`AZURE_ACR_NAME`

- Example: `opgweatherrushiacr`

`AZURE_WEBAPP_NAME`

- Example: `opg-weather-rushi`

`AZURE_WEBAPP_PUBLISH_PROFILE`

- Full XML contents of the Azure publish profile
- Download from:
  `Azure Portal -> Web App -> Overview -> Get publish profile`

`REGISTRY_USERNAME` and `REGISTRY_PASSWORD`

- Taken from:
  `Azure Portal -> Container Registry -> Access keys`

## Security Notes

Treat these as secrets:

- publish profile
- ACR username/password

Never commit them to the repo.

This repo ignores publish profile files with:

```gitignore
*.PublishSettings
```

If a publish profile is exposed, reset it in Azure and update the GitHub secret.

## How To Deploy Future Changes

After the workflow is set up, deployment is simple:

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

What happens next:

1. GitHub Actions starts automatically
2. Docker image is built for `linux/amd64`
3. Image is pushed to ACR
4. Azure Web App is updated
5. The live site reflects the new version

This applies to:

- frontend changes
- backend/API changes
- styling/UI updates
- Docker-related changes

## How To Trigger The Workflow

Right now the workflow runs automatically when you push to `main`.

To trigger a deployment:

```bash
git push origin main
```

If you want manual triggering later, add `workflow_dispatch` to the workflow file.

## How To Check Deployment Status

### In GitHub

Go to:

`GitHub -> Actions`

Check whether the workflow:

- built successfully
- pushed the Docker image
- deployed to Azure

### In Azure

Go to:

- `Web App -> Overview`
- `Web App -> Deployment Center`
- `Web App -> Log stream`

Use:

- **Platform logs** for image pull / startup issues
- **Runtime logs** for application-level errors

## Common Issues

### 1. `ImageNotFoundFailure`

Usually means:

- image was not pushed to ACR
- wrong image name or tag in Web App config
- stale deployment config

Check:

- `ACR -> Repositories -> opg-weather-app`
- Web App image/tag settings

### 2. `ImagePullUnauthorizedFailure`

Usually means:

- registry credentials are wrong
- ACR access is not configured correctly

For this deployment, the working fix was:

- use **ACR admin credentials**
- store them in GitHub secrets

### 3. App starts locally but not on Azure

Common cause on Apple Silicon:

- image built as `arm64`
- Azure expects `linux/amd64`

Fix:

- build with `linux/amd64`

## Custom Domain

You do **not** need a custom domain to use the app.

If you want a nicer URL later, you need:

1. your own domain from a domain provider
2. DNS records pointing that domain to Azure
3. Azure Web App `Custom domains` configuration

Without owning a domain, keep using the Azure URL.

## Summary

This project is deployed with:

- Azure App Service for hosting
- Azure Container Registry for images
- GitHub Actions for CI/CD
- automatic deploys on push to `main`

Normal update flow:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

That is enough to rebuild and redeploy the app.
