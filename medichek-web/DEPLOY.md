# Medichek Web - Static Deployment

This is a fully static web application that can be deployed without a backend server. All video processing happens client-side using MediaPipe.

## Quick Start (Static Deployment)

### 1. Configure Django Server URL

Edit `static/config.js`:
```javascript
const MedichekConfig = {
    djangoServerUrl: 'http://127.0.0.1:8000',  // Your Django server URL
    // ... rest of config
};
```

### 2. Deploy

**Option A: Simple HTTP Server (Testing)**
```bash
python -m http.server 8080
# Open: http://localhost:8080
```

**Option B: Netlify (Production)**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

**Option C: Any Static Host**
Upload these files to any static hosting:
- `index.html`
- `static/` folder

## Files Structure

```
medichek-web/
├── index.html              # Root HTML (for static hosting)
├── templates/
│   └── index.html         # Template HTML (for Flask)
├── static/
│   ├── config.js          # Configuration (Django URL)
│   ├── script.js          # Main application logic
│   └── style.css          # Styles
└── STATIC_DEPLOYMENT.md   # Full deployment guide
```

## Features

✅ No backend required - runs entirely in browser  
✅ Offline capable - tracks even without Django server  
✅ Mobile responsive - works on all devices  
✅ MediaPipe AI - face and hand tracking  
✅ OCR - text recognition with Tesseract.js  
✅ localStorage backup - saves data locally if submission fails  

## Configuration

### Django Server

Update `static/config.js`:
```javascript
djangoServerUrl: 'https://your-django-server.com'
```

### Auto-detect Environment

Enable auto-detection for different environments:
```javascript
useAutoDetect: true,
djangoServerUrl: 'http://127.0.0.1:8000',      // Development
productionDjangoUrl: 'https://your-server.com'  // Production
```

## Django Server CORS

Your Django server must allow CORS from your static site:

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8080",
    "https://your-static-site.com",
]
```

## Deployment Platforms

| Platform | Command | Notes |
|----------|---------|-------|
| **Local** | `python -m http.server 8080` | Testing only |
| **Netlify** | `netlify deploy --prod` | Free tier available |
| **Vercel** | `vercel --prod` | Automatic deployment |
| **GitHub Pages** | Push to `gh-pages` branch | Free for public repos |
| **AWS S3** | `aws s3 sync . s3://bucket/` | Need CloudFront for HTTPS |
| **Cloudflare Pages** | Connect Git repo | Auto-deploy on push |

## Testing

1. Start local server:
   ```bash
   python -m http.server 8080
   ```

2. Open browser:
   ```
   http://localhost:8080
   ```

3. Grant camera permissions

4. Click "Start Tracking"

## Production Checklist

- [ ] Update Django URL in `config.js`
- [ ] Configure CORS on Django server
- [ ] Deploy to HTTPS domain (required for camera)
- [ ] Test on mobile devices
- [ ] Test camera permissions
- [ ] Test with Django server running
- [ ] Test offline mode (without Django)

## Troubleshooting

**Camera not working:**
- Must use HTTPS in production (not http://)
- Check browser permissions

**CORS errors:**
- Verify Django CORS settings
- Check `config.js` has correct URL

**Server connection failed:**
- App still works offline
- Data saved to localStorage
- Can submit later when server available

## License

See main project LICENSE file.
