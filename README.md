# DC Replay Chat (v1.1)

A powerful tool to replay DC Inside chat history like a live stream.
This project uses **Next.js** for the frontend/backend and standard scraping techniques to visualize historical data.

## 🚀 New Features in v1.1

*   **Smart Time Search**: Automatically binary searches for the exact post ID corresponding to a date.
*   **Gallery Auto-Rotation**: Searching for "2022" on a 2024 gallery (e.g., `baseball_new13`) automatically redirects to the correct historical gallery (`baseball_new12`, `new11`...).
*   **Wayback Machine Assist**: Uses the Internet Archive to find post IDs for very old dates where live search fails.
*   **Portable Mode**: Now supports a standalone "No-Install" build.
*   **Safety First**:
    *   **DOM Overflow Protection**: Renders only the last 300 messages to prevent lag.
    *   **Rate Limiting**: Protects against IP bans.

## 📦 How to Use (Portable Version)

1.  Download the **DC_Replay_Portable.7z** file.
2.  Extract it.
3.  Run **`start.bat`**.
4.  Open `http://localhost:3000`.

## 🛠️ Development

```bash
npm install
npm run dev
```

## ⚠️ Disclaimer

This tool is for personal educational use only. Respect the `robots.txt` and terms of service of target websites.
