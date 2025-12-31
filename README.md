# DC Replay Chat (Live Reaction Player)

**DC Replay Chat** allows you to re-experience the "Live Reactions" of DC Inside galleries during past events.

![Preview](https://via.placeholder.com/800x400?text=DC+Replay+Chat+Preview)

## Features
- **Auto Scrape**: Automatically fetches past posts based on URL and Time.
- **Real-time Replay**: Simulates the chat flow of the past.
- **Heatmap**: Visualizes high-activity moments.
- **Portable**: Can be run without installation on Windows.
- **Secure**: Includes SSRF protection to only allow DC Inside URLs.

## How to Use

### Option 1: Web Version (Vercel)
Best for quick viewing of **recent events (1-2 hours)**.
1. Deploy to Vercel.
2. Share the URL.
3. *Note: Vercel Free Tier has a 10s timeout, so scraping very old data may fail.*

### Option 2: Portable PC Version (No Install)
Best for **heavy usage** (deep historical scraping).
1. Unzip the provided `DC_Replay_Portable` folder.
2. Run **`start.bat`**.
3. The app launches immediately in your browser.

---

## Bookmarklet
Add this to your bookmarks to launch the Web Version instantly from any gallery:

```javascript
javascript:(function(){
  const targetUrl = 'https://YOUR-VERCEL-APP-URL.vercel.app'; 
  const currentUrl = encodeURIComponent(window.location.href);
  window.open(targetUrl + '?url=' + currentUrl + '&auto=true', '_blank');
})();
```

## Developer Guide
To create the Portable Version, run **`create_portable_dist.bat`** in the project root.

---
*Created for The Singularity.*
