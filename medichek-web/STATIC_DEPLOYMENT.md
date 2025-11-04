# Static Site Deployment Guide

The Medichek Web Client can now be deployed as a **fully static site** without requiring a Flask server. All tracking happens client-side in the browser.

## What Changed

The Flask proxy server (`app.py`) has been removed. The JavaScript now makes direct API calls to the Django backend server.

## Deployment Options

### Option 1: Local File System (Testing)
Simply open `templates/index.html` directly in your browser:
```bash
# Windows
start templates/index.html

# macOS
open templates/index.html

# Linux
xdg-open templates/index.html
```

### Option 2: Simple HTTP Server (Recommended for Testing)

**Using Python:**
```bash
# Python 3
python -m http.server 8080

# Then open: http://localhost:8080/templates/index.html
```

**Using Node.js:**
```bash
npx http-server -p 8080

# Then open: http://localhost:8080/templates/index.html
```

### Option 3: Static Hosting Platforms

#### **Netlify**
1. Create a `netlify.toml` in project root:
```toml
[build]
  publish = "."
  command = "echo 'No build needed'"

[[redirects]]
  from = "/*"
  to = "/templates/index.html"
  status = 200
```

2. Deploy:
```bash
netlify deploy --prod
```

#### **Vercel**
1. Create a `vercel.json`:
```json
{
  "routes": [
    { "src": "/static/(.*)", "dest": "/static/$1" },
    { "src": "/(.*)", "dest": "/templates/index.html" }
  ]
}
```

2. Deploy:
```bash
vercel --prod
```

#### **GitHub Pages**
1. Rename `templates/index.html` to `index.html` (move to root)
2. Update paths in HTML:
   - Change `<link href="/static/style.css">` to `<link href="./static/style.css">`
   - Change `<script src="/static/script.js">` to `<script src="./static/script.js">`
3. Push to GitHub and enable Pages in repository settings

#### **AWS S3 + CloudFront**
```bash
# Upload files
aws s3 sync . s3://your-bucket-name/ --exclude "*.py" --exclude "*.yml" --exclude ".git/*"

# Set bucket for static website hosting
aws s3 website s3://your-bucket-name/ --index-document templates/index.html
```

#### **Cloudflare Pages**
Simply connect your Git repository and Cloudflare Pages will auto-deploy.

### Option 4: Docker (Static Nginx)

Create a `Dockerfile`:
```dockerfile
FROM nginx:alpine
COPY templates/ /usr/share/nginx/html/templates/
COPY static/ /usr/share/nginx/html/static/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t medichek-web .
docker run -p 8080:80 medichek-web
```

## Configuration

### Django Server URL

Update the Django server URL in `static/script.js`:

```javascript
// Configuration
const DJANGO_SERVER_URL = 'http://127.0.0.1:8000'; // Change this to your Django server URL
```

**For production:**
```javascript
const DJANGO_SERVER_URL = 'https://your-django-server.com';
```

**For environment-specific config:**
```javascript
const DJANGO_SERVER_URL = window.location.hostname === 'localhost' 
    ? 'http://127.0.0.1:8000'
    : 'https://your-production-django.com';
```

### CORS Configuration

Your Django server must allow CORS requests from the static site domain:

```python
# Django settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8080",
    "https://your-static-site.netlify.app",
    "https://your-domain.com",
]
```

## File Structure for Deployment

You only need these files:
```
medichek-web/
├── templates/
│   └── index.html          # Main HTML file
└── static/
    ├── script.js           # Client-side JavaScript
    └── style.css          # Styles
```

**Not needed for deployment:**
- `app.py` (Flask server - no longer used)
- `requirements.txt` (Python dependencies)
- `environment.yml` (Conda environment)
- `setup.ps1` (Setup script)

## Features

✅ **No Backend Required** - Runs entirely in the browser  
✅ **Offline Tracking** - Can track even without Django server  
✅ **localStorage Backup** - Saves analysis locally if submission fails  
✅ **MediaPipe Processing** - All AI processing happens client-side  
✅ **Mobile Responsive** - Works on phones, tablets, and desktop  

## Testing Locally

1. **Start a local web server:**
   ```bash
   python -m http.server 8080
   ```

2. **Open in browser:**
   ```
   http://localhost:8080/templates/index.html
   ```

3. **Test without Django server:**
   - The app will show "Server Disconnected" but still work
   - All tracking happens locally
   - Analysis is saved to browser localStorage

4. **Test with Django server:**
   - Start your Django server on port 8000
   - The app will connect and submit results

## Production Checklist

- [ ] Update `DJANGO_SERVER_URL` in `script.js`
- [ ] Configure CORS on Django server
- [ ] Test camera permissions (HTTPS required for camera on mobile)
- [ ] Test on target browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices
- [ ] Set up SSL certificate (required for camera access)
- [ ] Configure CDN for MediaPipe libraries (optional)
- [ ] Add analytics tracking (optional)

## Security Notes

1. **HTTPS Required**: Camera access requires HTTPS in production
2. **CORS**: Configure Django server to allow your static site domain
3. **API Keys**: Don't expose sensitive keys in client-side code
4. **Data Privacy**: All video processing happens locally (never uploaded)

## Troubleshooting

**Camera not working on mobile:**
- Ensure site is served over HTTPS
- Check browser permissions

**CORS errors:**
- Verify Django CORS configuration
- Check `DJANGO_SERVER_URL` is correct

**MediaPipe fails to load:**
- Check internet connection (CDN libraries)
- Verify browser compatibility

**Analysis not submitting:**
- Check Django server is running
- Check browser console for errors
- Analysis is saved locally as backup
