# Medichek Web - Quick Start

Get started in **under 1 minute**! 🚀

## For Testing Locally

### Option 1: PowerShell Script (Windows)
```powershell
.\start-static.ps1
```
Opens automatically at `http://localhost:8080`

### Option 2: Python HTTP Server
```bash
python -m http.server 8080
```
Then open: `http://localhost:8080`

### Option 3: Node.js HTTP Server
```bash
npx http-server -p 8080
```
Then open: `http://localhost:8080`

## For Production Deployment

### Step 1: Configure Django URL
Edit `static/config.js`:
```javascript
djangoServerUrl: 'https://your-django-server.com'
```

### Step 2: Deploy
Pick any platform:

**Netlify (Recommended)**
```bash
netlify deploy --prod
```

**Vercel**
```bash
vercel --prod
```

**GitHub Pages**
1. Push to GitHub
2. Enable Pages in Settings
3. Done!

**Any Static Host**
- Upload `index.html` and `static/` folder
- That's it!

### Step 3: Configure Django CORS
```python
# Django settings.py
CORS_ALLOWED_ORIGINS = [
    "https://your-site.com",
]
```

## That's It!

No installation. No dependencies. No setup.

Just open in a browser and it works! 🎉

---

### Need More Help?

- **Deployment Guide**: See [DEPLOY.md](DEPLOY.md)
- **All Options**: See [STATIC_DEPLOYMENT.md](STATIC_DEPLOYMENT.md)
- **Full Docs**: See [README.md](README.md)
