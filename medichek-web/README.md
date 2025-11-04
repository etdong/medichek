# Medichek Web Client

**Fully static web application** for patient medication tracking. All tracking and analysis operations are performed locally in the browser using MediaPipe AI. No backend required to run the application.

## Architecture

**Pure Client-Side Application**: This is a static website that runs entirely in your browser without requiring any server-side code. See [DEPLOY.md](DEPLOY.md) for deployment options.

### Key Features
- ✅ **No Python required** - Pure HTML/CSS/JavaScript
- ✅ **No backend needed** - Runs as static site
- ✅ **Local AI processing** - MediaPipe runs in browser
- ✅ **Offline capable** - Works without Django server
- ✅ **Privacy-focused** - Data stays on device until submission
- ✅ **Deploy anywhere** - Any static hosting works

## Features
- Web interface with camera access
- Client-side session management
- MediaPipe face/hand tracking (browser-based)
- Face mesh for rubbing detection
- OCR with Tesseract.js
- localStorage backup for offline operation
- Optional Django backend submission

## Quick Start

### 1. Configure Django Server (Optional)

Edit `static/config.js`:
```javascript
const MedichekConfig = {
    djangoServerUrl: 'http://127.0.0.1:8000',  // Your Django server URL
    // ...
};
```

### 2. Start Local Server (for testing)

```bash
# Using Python (simplest)
python -m http.server 8080

# Or use the provided script
.\start-static.ps1
```

### 3. Open in Browser

```
http://localhost:8080
```

That's it! No installation, no dependencies, no setup required.

## Deployment

Deploy to any static hosting platform:

```bash
# Netlify
netlify deploy --prod

# Vercel  
vercel --prod

# Or upload to: GitHub Pages, AWS S3, Cloudflare Pages, etc.
```

See [DEPLOY.md](DEPLOY.md) for detailed deployment instructions.

## Usage

### Workflow (5 Steps)

1. **Step 1: Camera** - Enable camera access
2. **Step 2: Face Centering** - Position face in center
3. **Step 3: OCR** - Capture product label showing "TEST"
4. **Step 4: Palm Detection** - Show palm with fingers down
5. **Step 5: Face Rubbing** - Rub forehead, left cheek, right cheek (5 seconds each)

### How It Works

1. **Browser-Based Tracking**
   - Session ID generated in browser
   - All detection results stored in memory
   - No server communication during tracking

2. **AI Processing**
   - MediaPipe models run in browser via WebAssembly
   - Face detection, hand tracking, face mesh
   - Tesseract.js for OCR
   - All processing happens locally

3. **Optional Server Submission**
   - Final JSON analysis sent to Django server
   - Works even if Django was offline during tracking
   - Falls back to localStorage if submission fails
   - Can retry later

### Offline Operation

The application works completely offline:
- All tracking happens in browser
- AI models loaded from CDN (cached after first load)
- Results saved to localStorage
- Submit when Django server becomes available

## File Structure

```
medichek-web/
├── index.html              # Main entry point
├── static/
│   ├── config.js          # Configuration (Django URL)
│   ├── script.js          # Application logic  
│   └── style.css          # Styles
├── templates/
│   └── index.html         # Alternative entry point
├── DEPLOY.md              # Quick deployment guide
├── STATIC_DEPLOYMENT.md   # Detailed deployment options
└── MIGRATION_SUMMARY.md   # Migration documentation
```

## Configuration

### Django Server URL

Edit `static/config.js`:
```javascript
const MedichekConfig = {
    // Simple configuration
    djangoServerUrl: 'https://your-django-server.com',
    
    // Or use auto-detect for dev/prod
    useAutoDetect: true,
    developmentDjangoUrl: 'http://127.0.0.1:8000',
    productionDjangoUrl: 'https://api.medichek.com'
};
```

### Django CORS (Required)

Your Django server must allow CORS from your static site:

```python
# Django settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8080",
    "https://your-static-site.com",
]
```

## API Integration (Optional)

The app can optionally submit results to Django:

### `GET /api/health/`
Check if Django server is available

### `POST /api/analysis/submit/`
Submit complete analysis results

**Payload Example:**
```json
{
  "session_id": "client-1730736000000-abc123",
  "patient_id": "patient-1730736000000",
  "client_submitted_at": "2025-11-04T12:00:00.000Z",
  "session_duration_seconds": 120.5,
  "summary": {
    "total_frames_analyzed": 150,
    "face_detection_rate": 0.95,
    "hand_detection_rate": 0.88
  },
  "step_data": [...],
  "assessment": {
    "completed": true,
    "quality_score": 0.82
  }
}
```

## Development

### Static Files
- `static/config.js` - Configuration
- `static/script.js` - Session management and AI tracking
- `static/style.css` - UI styling
- `index.html` / `templates/index.html` - Main interface

### External Dependencies (CDN)
- MediaPipe Face Detection
- MediaPipe Hands
- MediaPipe Face Mesh
- Tesseract.js (OCR)

All loaded from CDN, no installation required.

## Browser Requirements

- Modern browser with WebAssembly support
- Camera access (requires HTTPS in production)
- localStorage support
- Recommended: Chrome 90+, Firefox 88+, Safari 14+

## Deployment Platforms

| Platform | Free Tier | HTTPS | Notes |
|----------|-----------|-------|-------|
| **Netlify** | ✅ | ✅ | Recommended |
| **Vercel** | ✅ | ✅ | Auto-deploy from Git |
| **GitHub Pages** | ✅ | ✅ | Free for public repos |
| **Cloudflare Pages** | ✅ | ✅ | Fast global CDN |
| **AWS S3** | ❌ | ✅ | Requires CloudFront |

## Architecture Benefits

1. **Zero Setup** - No installation, no dependencies
2. **Privacy** - Patient data stays in browser until submitted
3. **Performance** - No server latency for tracking
4. **Scalability** - CDN handles all traffic
5. **Reliability** - No server to maintain
6. **Cost** - Free static hosting available

## Documentation

- **[DEPLOY.md](DEPLOY.md)** - Quick deployment guide
- **[STATIC_DEPLOYMENT.md](STATIC_DEPLOYMENT.md)** - All deployment options
- **[MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)** - Migration from Flask

## License

See main project LICENSE file.
