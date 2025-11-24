# TTS Server Deployment Guide

## Option 1: Render (Recommended - FREE & EASIEST) ⭐

### Why Render?
- ✅ **100% Free tier** (no credit card needed)
- ✅ **Super easy** - just connect GitHub
- ✅ **Auto-deploys** on git push
- ✅ **HTTPS included**
- ✅ **Sleeps after 15 min inactivity** (wakes on first request)

### Steps:

1. **Create account**: Go to [render.com](https://render.com) and sign up (free)

2. **Create new Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select your repository
   - Choose the `tts-server.js` file

3. **Configure**:
   - **Name**: `tts-server` (or any name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node tts-server.js`
   - **Plan**: Free

4. **Add Environment Variable** (optional, for security):
   - Go to "Environment" tab
   - Add: `GOOGLE_TTS_API_KEY` = `your-api-key-here`

5. **Deploy**: Click "Create Web Service"
   - Wait 2-3 minutes for deployment
   - Your TTS server URL will be: `https://tts-server.onrender.com`

6. **Update your main app** (`script.js`):
   ```javascript
   const ttsUrl = 'https://your-tts-server-name.onrender.com/api/tts/synthesize';
   ```

---

## Option 2: Railway (Also FREE & Easy)

### Why Railway?
- ✅ **$5 free credit monthly** (plenty for a small server)
- ✅ **Very easy** deployment
- ✅ **No sleep** (always running)
- ⚠️ Requires credit card (but won't charge if under free tier)

### Steps:

1. **Create account**: Go to [railway.app](https://railway.app) and sign up

2. **New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure**:
   - Railway auto-detects Node.js
   - Set start command: `node tts-server.js`
   - Add environment variable: `GOOGLE_TTS_API_KEY` (optional)

4. **Deploy**: Railway auto-deploys
   - Your URL: `https://your-app-name.up.railway.app`

5. **Update script.js** with Railway URL

---

## Option 3: Fly.io (FREE & Good)

### Why Fly.io?
- ✅ **Free tier** available
- ✅ **No sleep** (always running)
- ✅ **Global edge network**
- ⚠️ Slightly more setup

### Steps:

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`

2. Login: `fly auth login`

3. Create app: `fly launch` (in your TTS server directory)

4. Deploy: `fly deploy`

---

## Quick Comparison

| Platform | Free Tier | Ease | Sleep? | Best For |
|----------|-----------|------|--------|----------|
| **Render** ⭐ | ✅ Yes | ⭐⭐⭐⭐⭐ | Yes (15min) | **Easiest** |
| **Railway** | ✅ $5 credit | ⭐⭐⭐⭐ | No | Always on |
| **Fly.io** | ✅ Yes | ⭐⭐⭐ | No | Global |

## Recommendation: Use Render! 🎯

It's the easiest and completely free. The 15-minute sleep is fine because:
- First request wakes it up (takes ~30 seconds)
- Your app has browser TTS fallback anyway
- It's free forever!

---

## After Deployment

Update `script.js` line ~932:

```javascript
// Replace this:
const ttsUrl = window.location.origin + '/api/tts/synthesize';

// With this (for Render):
const ttsUrl = 'https://your-tts-server-name.onrender.com/api/tts/synthesize';
```

That's it! Your TTS server will work on Render. 🚀

