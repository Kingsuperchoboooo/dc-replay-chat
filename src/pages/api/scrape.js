import { parseDCList } from '@/lib/parser';

// Helper: Extract valid Gallery ID and type (major vs minor) from URL
const extractGalleryInfo = (url) => {
    try {
        // Handle cases like "lists/?id=" by letting URL object parse it normally
        const urlObj = new URL(url);
        const id = urlObj.searchParams.get('id');
        const isMinor = urlObj.hostname.includes('mgallery') || urlObj.pathname.includes('mgallery');

        if (!id) return null;
        return { id, isMinor };
    } catch (e) {
        return null;
    }
};

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, targetTime, duration = 60 } = req.query; // duration in minutes

    if (!url || !targetTime) {
        return res.status(400).json({ error: 'Missing required parameters: url, targetTime' });
    }

    // 1. URL Validation (Prevent SSRF)
    try {
        const parsedUrl = new URL(url);
        if (!parsedUrl.hostname.includes('dcinside.com')) {
            return res.status(400).json({ error: 'Invalid URL: Only dcinside.com URLs are allowed.' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format.' });
    }

    const info = extractGalleryInfo(url);
    if (!info) {
        return res.status(400).json({ error: 'Invalid DC Inside URL.' });
    }

    const { id, isMinor } = info;
    const baseUrl = isMinor
        ? 'https://gall.dcinside.com/mgallery/board/lists'
        : 'https://gall.dcinside.com/board/lists';

    const targetDate = new Date(targetTime);
    const targetEnd = new Date(targetDate.getTime() + (duration * 60 * 1000));

    if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: 'Invalid targetTime format.' });
    }

    // Settings
    const BATCH_SIZE = 5;       // Fetch 5 pages at once
    const MAX_PAGES = 1000;      // Increased limit for active galleries
    let allPosts = [];
    let reachedTarget = false;

    // Headers to mimic browser (critical for DC)
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Referer': 'https://gall.dcinside.com/',
    };

    // Verify Date Parsing
    console.log(`[Scrape] Start. URL: ${url}, Target: ${targetTime} (${targetDate.toString()})`);

    try {
        // Start from Page 1 and go deeper
        for (let batchStart = 1; batchStart <= MAX_PAGES; batchStart += BATCH_SIZE) {
            if (reachedTarget) break;

            console.log(`[Scrape] Batch ${batchStart} ~ ${batchStart + BATCH_SIZE - 1}...`);

            // Create parallel requests
            const promises = [];
            for (let i = 0; i < BATCH_SIZE; i++) {
                const pageNum = batchStart + i;
                const pageUrl = `${baseUrl}?id=${id}&page=${pageNum}`;
                promises.push(
                    fetch(pageUrl, { headers }).then(r => r.text())
                );
            }

            // Wait for all pages in batch
            const htmls = await Promise.all(promises);

            // Parse each page
            for (const html of htmls) {
                const posts = parseDCList(html);
                if (posts.length === 0) continue;

                // Debug first post
                // console.log(`[Scrape] First post on page: ${posts[0].timestamp} | Last: ${posts[posts.length-1].timestamp}`);

                const oldestOnPage = posts[0]; // Oldest on this page
                const newestOnPage = posts[posts.length - 1]; // Newest on this page (closest to Now)

                if (!oldestOnPage?.timestamp) continue;

                const oldestTime = new Date(oldestOnPage.timestamp);

                // Add to collection
                allPosts.push(...posts);

                // Stop Condition:
                // If the OLDEST post on this page is OLDER than our Target Start Time,
                // then this page (or previous pages) covers our target. 
                // We can stop fetching deeper after this batch (or ensuring we have enough buffer).
                if (oldestTime <= targetDate) {
                    console.log(`[Scrape] Target reached! Oldest (${oldestTime.toString()}) <= Target (${targetDate.toString()})`);
                    reachedTarget = true;
                }
            }
        }

        console.log(`[Scrape] Total Scraped Posts: ${allPosts.length}`);

        // Filter validation
        // `allPosts` likely contains duplicates if pages shifted, but `parseDCList` handles raw list.
        // We should deduplicate by ID just in case.
        const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values());

        // Filter by Time Range
        const relevantPosts = uniquePosts.filter(p => {
            const t = new Date(p.timestamp);
            return t >= targetDate && t <= targetEnd;
        });

        console.log(`[Scrape] Filtered Relevant Posts: ${relevantPosts.length}`);

        // Sort: Oldest -> Newest
        relevantPosts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (relevantPosts.length === 0) {
            console.log(`[Scrape] Failed. No posts in range.`);
            return res.status(404).json({ error: 'No posts found in that time range (try increasing usage duration or checking date).' });
        }

        res.status(200).json({ posts: relevantPosts, count: relevantPosts.length });

    } catch (error) {
        console.error('Scrape Error:', error);
        res.status(500).json({ error: 'Failed to scrape DC Inside.' });
    }
}
