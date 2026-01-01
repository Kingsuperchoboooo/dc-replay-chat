
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    try {
        // Basic validation
        const urlObj = new URL(url);
        if (!urlObj.hostname.includes('dcinside.com')) {
            return res.status(400).json({ error: 'Invalid domain' });
        }

        // Headers are important for DC
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Referer': 'https://gall.dcinside.com/',
        };

        const response = await fetch(url, { headers });
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch page' });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract Date
        // Standard PC version: .gall_date
        // Mobile version: .date or similar
        let dateStr = $('.gall_date').attr('title') || $('.gall_date').text();

        // Fallback for different skins or mobile
        if (!dateStr) {
            dateStr = $('.gallery_view_head .date').text();
        }

        if (!dateStr) {
            return res.status(404).json({ error: 'Could not find date in post' });
        }

        // Clean up date string if needed (DC sometimes puts extra chars)
        dateStr = dateStr.trim();

        // DC Date format usually: "2023.12.31 15:44:30" or "2023-12-31 ..."
        // JavaScript Date constructor handles most standard formats, but we should be careful.
        // Ensure it's parsable.
        const date = new Date(dateStr);

        if (isNaN(date.getTime())) {
            return res.status(500).json({ error: `Failed to parse date: ${dateStr}` });
        }

        return res.status(200).json({
            timestamp: date.toISOString(),
            originalString: dateStr
        });

    } catch (error) {
        console.error('Peek Error:', error);
        return res.status(500).json({ error: 'Server error processing URL' });
    }
}
