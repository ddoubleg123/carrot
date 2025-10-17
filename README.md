# Windsurf Project

A comprehensive platform featuring the Carrot social media application with advanced AI-powered image generation using SDXL.

## 🚀 Quick Start

- **Getting Started:** See [docs/guides/CASCADE_STARTUP_GUIDE.md](docs/guides/CASCADE_STARTUP_GUIDE.md)
- **SDXL Setup:** See [docs/sdxl/SDXL-QUICK-REFERENCE.md](docs/sdxl/SDXL-QUICK-REFERENCE.md)
- **Architecture:** See [docs/deployment/DEPLOYMENT_ARCHITECTURE.md](docs/deployment/DEPLOYMENT_ARCHITECTURE.md)

## 📚 Documentation

All documentation is organized in the [`docs/`](docs/) folder:

### [📖 Documentation Index](docs/README.md)

- **[docs/sdxl/](docs/sdxl/)** - SDXL & AI image generation (includes new Hires Fix feature!)
- **[docs/deployment/](docs/deployment/)** - System architecture & deployment
- **[docs/guides/](docs/guides/)** - Getting started guides & protocols
- **[docs/infrastructure/](docs/infrastructure/)** - Infrastructure & services

### Featured Documentation

- **[Hires Fix Quick Start](docs/sdxl/QUICK-START-HIRES-FIX.md)** - NEW! Two-pass upscaling for 4x better quality
- **[SDXL Migration Guide](docs/sdxl/SDXL-MIGRATION-GUIDE.md)** - Upgrade to SDXL for professional-quality images
- **[Cascade Startup Guide](docs/guides/CASCADE_STARTUP_GUIDE.md)** - Get the project running

## 🎨 Features

### Carrot Platform
- Express.js HTTP server with health checks
- Firebase Storage integration
- Redis job queue support
- Docker containerized deployment
- CI/CD pipeline with GitHub Actions

### SDXL Image Generation
- Stable Diffusion XL (SDXL) for high-quality 1024x1024 images
- **NEW: Hires Fix** - Two-pass generation for 1536x1536 professional quality
- **NEW: RealESRGAN** - Neural network upscaling for superior quality
- **NEW: CodeFormer** - AI-powered face restoration
- Seed support for reproducibility
- Production-ready API on Vast.ai

## 🛠️ Development

### Carrot Worker

```bash
npm install
npm run dev
```

### SDXL API

See [docs/sdxl/SDXL-QUICK-REFERENCE.md](docs/sdxl/SDXL-QUICK-REFERENCE.md) for setup and deployment.

## 🚀 Deployment

### Carrot Worker Deployment

The service is deployed using Docker images built in CI/CD:

1. Push to `main` branch triggers GitHub Actions
2. Docker image built and pushed to GHCR
3. Render deploys from the container image

### SDXL Deployment

See comprehensive deployment guide: [docs/sdxl/SDXL-MIGRATION-GUIDE.md](docs/sdxl/SDXL-MIGRATION-GUIDE.md)

## 🔍 Health Checks

### Carrot Worker
- `GET /healthz` - Detailed health status
- `GET /` - Basic service info

### SDXL API
- `GET /health` - Model status and VRAM info

## 📊 Project Structure

```
windsurf-project/
├── carrot/              # Carrot social platform application
├── functions/           # Firebase Cloud Functions
├── worker/              # Video ingestion worker
├── docs/                # 📚 All documentation (organized)
│   ├── sdxl/           # SDXL & image generation docs
│   ├── deployment/     # Architecture & deployment
│   ├── guides/         # Getting started guides
│   └── infrastructure/ # Infrastructure setup
├── upgraded-sdxl-api.py # SDXL API with Hires Fix
└── test-hires-fix.py   # Test suite for Hires Fix
```

## 🌟 Recent Updates

- **2025-10-13:** Added Hires Fix feature for 4x better image quality
- **2025-10-13:** Organized all documentation into `docs/` with subdirectories
- **2025-10-13:** Created comprehensive documentation index

## 📞 Support & Documentation

For detailed documentation on any component, see the [Documentation Index](docs/README.md).

### Quick Links
- **Starting fresh?** → [CASCADE_STARTUP_GUIDE.md](docs/guides/CASCADE_STARTUP_GUIDE.md)
- **Want better images?** → [QUICK-START-HIRES-FIX.md](docs/sdxl/QUICK-START-HIRES-FIX.md)
- **Need to deploy?** → [DEPLOYMENT_ARCHITECTURE.md](docs/deployment/DEPLOYMENT_ARCHITECTURE.md)

## Environment Variables

### Carrot Worker
Required:
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` - Firebase service account JSON
- `FIREBASE_STORAGE_BUCKET` - Firebase Storage bucket name
- `REDIS_URL` - Redis connection string
- `INGEST_WORKER_SECRET` - Shared secret for authentication

Optional:
- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (default: development)

### SDXL API
See [docs/sdxl/SDXL-DEPLOYMENT-PLAN.md](docs/sdxl/SDXL-DEPLOYMENT-PLAN.md) for configuration details.

---

**For complete documentation, visit [`docs/`](docs/) folder.**
