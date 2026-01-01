import { parseDCList } from '@/lib/parser';

// Helper: Extract valid Gallery ID and type (major vs minor) from URL
const extractGalleryInfo = (url) => {
    try {
        const urlObj = new URL(url);
        let id = urlObj.searchParams.get('id');

        // Mobile / clean path support: extract ID from path if not in params
        // Example: https://m.dcinside.com/board/cartoon -> id=cartoon
        if (!id) {
            const match = urlObj.pathname.match(/\/board\/([a-zA-Z0-9_]+)/);
            if (match) id = match[1];
        }

        if (!id) return null;

        const isMinor = urlObj.hostname.includes('mgallery') ||
            urlObj.pathname.includes('mgallery') ||
            (urlObj.searchParams.get('class') === 'mgallery');

        return { id, isMinor };
    } catch (e) {
        return null;
    }
};

// Helper: Fetch IDs and Dates from page - unified logic
const fetchPageInfo = async (url, headers) => {
    try {
        const text = await fetch(url, { headers }).then(r => r.text());
        const posts = parseDCList(text);
        if (!posts || posts.length === 0) return { minId: null, maxId: null, minDate: null, maxDate: null };

        const ids = posts.map(p => Number(p.id)).filter(n => !isNaN(n));
        const dates = posts.map(p => new Date(p.timestamp).getTime()).filter(n => !isNaN(n));

        return {
            minId: ids.length ? Math.min(...ids) : null,
            maxId: ids.length ? Math.max(...ids) : null,
            minDate: dates.length ? Math.min(...dates) : null, // Oldest on page
            maxDate: dates.length ? Math.max(...dates) : null, // Newest on page
            count: ids.length
        };
    } catch (e) {
        return { minId: null, maxId: null, minDate: null, maxDate: null };
    }
};

// **Wayback Machine Integration**
// Finds a Post ID that existed around the targetTime
const getIDFromWayback = async (galleryId, isMinor, targetTime) => {
    try {
        const dateStr = new Date(targetTime).toISOString().replace(/[-T:.Z]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
        const baseUrl = isMinor
            ? `https://gall.dcinside.com/mgallery/board/lists?id=${galleryId}`
            : `https://gall.dcinside.com/board/lists?id=${galleryId}`;

        // Use 'wayback/available' API for "closest" snapshot
        const wbUrl = `https://archive.org/wayback/available?url=${baseUrl}&timestamp=${dateStr}`;
        console.log(`[Wayback] Querying: ${wbUrl}`);

        const res = await fetch(wbUrl);
        const data = await res.json();

        if (!data?.archived_snapshots?.closest) {
            console.log('[Wayback] No close snapshot found.');
            return null;
        }

        const snapshot = data.archived_snapshots.closest;
        const snapshotTimestamp = snapshot.timestamp; // YYYYMMDDHHMMSS
        console.log(`[Wayback] Found Snapshot: ${snapshotTimestamp} (Gap: ${Math.abs(Number(snapshotTimestamp) - Number(dateStr))})`);

        // Check if snapshot is too far (e.g. > 7 days)
        // Simple string diff is risky. Convert to Date.
        const snapDate = new Date(
            snapshotTimestamp.slice(0, 4),
            snapshotTimestamp.slice(4, 6) - 1,
            snapshotTimestamp.slice(6, 8),
            snapshotTimestamp.slice(8, 10),
            snapshotTimestamp.slice(10, 12),
            snapshotTimestamp.slice(12, 14)
        );
        const diffHours = Math.abs(snapDate - new Date(targetTime)) / 36e5;

        if (diffHours > 48) {
            console.log(`[Wayback] Snapshot is too distant (${diffHours.toFixed(1)} hours). Skipping to avoid ID mismatch.`);
            return null;
        }

        const snapshotUrl = snapshot.url;

        // Fetch snapshot
        console.log(`[Wayback] Fetching Snapshot HTML...`);
        const html = await fetch(snapshotUrl).then(r => r.text());

        const posts = parseDCList(html);
        if (posts && posts.length > 0) {
            // Filter out obviously bad IDs (NaN is already filtered by parser, but let's be safe)
            const ids = posts.map(p => Number(p.id)).filter(n => !isNaN(n));

            if (ids.length > 0) {
                // Return the MAX ID found to avoid notices
                const bestId = Math.max(...ids);
                console.log(`[Wayback] Extracted Best ID (Max) from snapshot: ${bestId} (Candidates: ${ids.length})`);
                return bestId;
            }
        }
    } catch (e) {
        console.error(`[Wayback] Error: ${e.message}`);
    }
    return null;
};

// **Smart Page Search (Binary Search)**
const findPageForPost = async (baseUrl, galleryId, targetPostId, headers) => {
    const target = Number(targetPostId);
    console.log(`[SmartSearch-ID] Looking for Post ID: ${target}`);

    let lowerPage = 1;
    let upperPage = 1;
    let foundRange = false;

    // 1. Exponential Search
    const p1 = await fetchPageInfo(`${baseUrl}?id=${galleryId}&page=1`, headers);
    if (p1.minId && target > p1.maxId) return 1;

    for (let i = 1; i <= 20; i++) {
        let checkPage = Math.pow(10, i);
        // SAFETY LIMIT: Increased to 20,000,000 to support massive galleries
        if (checkPage > 20000000) checkPage = 20000000;

        console.log(`[SmartSearch-ID] Probing Page ${checkPage}...`);
        const info = await fetchPageInfo(`${baseUrl}?id=${galleryId}&page=${checkPage}`, headers);

        if (!info.maxId) {
            upperPage = checkPage;
            lowerPage = Math.pow(10, i - 1);
            foundRange = true;
            console.log(`[SmartSearch-ID] End of list. Range: ${lowerPage}~${upperPage}`);
            break;
        }

        if (target > info.maxId) {
            upperPage = checkPage;
            lowerPage = Math.max(1, Math.pow(10, i - 1));
            foundRange = true;
            console.log(`[SmartSearch-ID] Bracket found! Range: ${lowerPage}~${upperPage}`);
            break;
        }

        // Break if we hit the cap to prevent infinite loop of checking same page
        if (checkPage === 20000000) {
            // If we are here, it means target <= info.maxId even at 20M pages?
            // Or target is OLDER than page 20M? (ID < MinID).
            // If ID > MaxID, we caught it above.
            // If ID < MinID (Target is OLDER than 20Mth page), we need to go deeper?
            // But 20M pages is effectively end of world.
            // Assume end.
            upperPage = checkPage * 2; // Just double it generically
            lowerPage = checkPage;
            foundRange = true;
            break;
        }
    }

    if (!foundRange) return 1;

    // 2. Binary Search
    let bestPage = lowerPage;
    let min = lowerPage;
    let max = upperPage;

    while (min <= max) {
        let mid = Math.floor((min + max) / 2);
        const info = await fetchPageInfo(`${baseUrl}?id=${galleryId}&page=${mid}`, headers);
        if (!info.maxId) { max = mid - 1; continue; }

        if (target >= info.minId && target <= info.maxId) {
            console.log(`[SmartSearch-ID] FOUND! Page ${mid}`);
            return mid;
        }
        if (target > info.maxId) { max = mid - 1; bestPage = mid; }
        else { min = mid + 1; }
    }
    return bestPage;
};

// **Time-Based Binary Search**
const findPageForTime = async (baseUrl, galleryId, targetTimeMs, headers) => {
    console.log(`[SmartSearch-Time] Looking for Time: ${new Date(targetTimeMs).toLocaleString()}`);

    let lowerPage = 1;
    let upperPage = 1;
    let foundRange = false;

    // 1. Exponential
    const p1 = await fetchPageInfo(`${baseUrl}?id=${galleryId}&page=1`, headers);
    if (p1.maxDate && targetTimeMs > p1.maxDate) {
        console.log(`[SmartSearch-Time] Target is newer than Page 1.`);
        return 1;
    }

    for (let i = 1; i <= 20; i++) {
        let checkPage = Math.pow(10, i);
        if (checkPage > 20000000) checkPage = 20000000;

        console.log(`[SmartSearch-Time] Probing Page ${checkPage}...`);
        const info = await fetchPageInfo(`${baseUrl}?id=${galleryId}&page=${checkPage}`, headers);

        if (!info.maxDate) {
            upperPage = checkPage;
            lowerPage = Math.pow(10, i - 1);
            foundRange = true;
            console.log(`[SmartSearch-Time] End of list. Range: ${lowerPage}~${upperPage}`);
            break;
        }

        if (targetTimeMs > info.maxDate) {
            upperPage = checkPage;
            lowerPage = Math.max(1, Math.pow(10, i - 1));
            foundRange = true;
            console.log(`[SmartSearch-Time] Bracket found! Range: ${lowerPage}~${upperPage}`);
            break;
        }

        if (checkPage === 20000000) {
            upperPage = checkPage * 2;
            lowerPage = checkPage;
            foundRange = true;
            break;
        }
    }

    if (!foundRange) return 1;

    // 2. Binary
    let bestPage = lowerPage;
    let min = lowerPage;
    let max = upperPage;
    while (min <= max) {
        let mid = Math.floor((min + max) / 2);
        const info = await fetchPageInfo(`${baseUrl}?id=${galleryId}&page=${mid}`, headers);
        if (!info.maxDate) { max = mid - 1; continue; }

        if (targetTimeMs >= info.minDate && targetTimeMs <= info.maxDate) {
            return mid;
        }
        if (targetTimeMs > info.maxDate) { max = mid - 1; bestPage = mid; }
        else { min = mid + 1; }
    }
    return bestPage;
};

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, targetTime, duration = 60, targetPostId } = req.query;

    if (!url || (!targetTime && !targetPostId)) {
        return res.status(400).json({ error: 'Missing required parameters: url, targetTime (or targetPostId)' });
    }

    // 1. URL Validation
    try {
        const parsedUrl = new URL(url);
        const allowedHosts = ['gall.dcinside.com', 'm.dcinside.com'];
        if (!allowedHosts.includes(parsedUrl.hostname)) {
            return res.status(400).json({ error: 'Invalid URL: Only gall.dcinside.com or m.dcinside.com are allowed.' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Invalid URL format.' });
    }

    const info = extractGalleryInfo(url);
    if (!info) {
        return res.status(400).json({ error: 'Invalid DC Inside URL. Could not find Gallery ID.' });
    }


    let { id: currentGalleryId, isMinor } = info;

    const targetDate = new Date(targetTime);
    const durationMs = duration * 60 * 1000;
    const searchTargetDate = new Date(targetDate.getTime() + durationMs);
    const targetEnd = searchTargetDate; // We search for the future-end first

    if (isNaN(targetDate.getTime()) && !targetPostId) {
        return res.status(400).json({ error: 'Invalid targetTime format.' });
    }

    const BATCH_SIZE = 5;
    const MAX_PAGES = 1000;
    const MAX_HOPS = 50;

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Referer': 'https://gall.dcinside.com/',
    };

    console.log(`[Scrape] Start. URL: ${url} (Initial ID: ${currentGalleryId})`);

    let hops = 0;

    // Gallery Migration Loop
    while (hops < MAX_HOPS) {
        console.log(`[Scrape-Attempt] Gallery: ${currentGalleryId} (Hop ${hops})`);

        const baseUrl = isMinor
            ? `https://gall.dcinside.com/mgallery/board/lists`
            : `https://gall.dcinside.com/board/lists`;

        try {
            let startPage = 1;
            let foundValidStart = false;

            // Strategy Selection
            try {
                const u = new URL(url);
                const p = u.searchParams.get('page');
                if (p && hops === 0) { // Only use manual page for the FIRST gallery
                    startPage = parseInt(p, 10);
                    console.log(`[Scrape] Starting from URL Page: ${startPage}`);
                    foundValidStart = true;
                } else if (targetPostId && hops === 0) { // Only use ID for FIRST gallery
                    startPage = await findPageForPost(baseUrl, currentGalleryId, targetPostId, headers);
                    console.log(`[Scrape] ID-Search Result: ${startPage}`);
                    foundValidStart = true;
                } else if (!isNaN(targetEnd.getTime())) {
                    // Try Time Search
                    console.log(`[Scrape] Time Search on ${currentGalleryId} for ${targetEnd.toLocaleString()}`);
                    startPage = await findPageForTime(baseUrl, currentGalleryId, targetEnd.getTime(), headers);
                    console.log(`[Scrape] Time-Search Result: ${startPage}`);
                    foundValidStart = true;
                }
            } catch (e) {
                console.error(e);
            }

            let allPosts = [];
            let reachedTarget = false;
            let galleryTooNew = false;

            // Scrape Loop
            for (let batchStart = startPage; batchStart <= (startPage + MAX_PAGES); batchStart += BATCH_SIZE) {
                if (reachedTarget) break;

                // Rate Limit Delay
                await new Promise(r => setTimeout(r, 100));

                console.log(`[Scrape] Batch ${batchStart}...`);
                const promises = [];
                for (let i = 0; i < BATCH_SIZE; i++) {
                    const pageNum = batchStart + i;
                    const pageUrl = `${baseUrl}?id=${currentGalleryId}&page=${pageNum}`;
                    promises.push(fetch(pageUrl, { headers }).then(r => r.text()));
                }

                const htmls = await Promise.all(promises);
                let batchHasPosts = false;

                for (const html of htmls) {
                    const posts = parseDCList(html);
                    if (!posts || !posts.length) continue;

                    batchHasPosts = true;
                    allPosts.push(...posts);

                    const pageOldestTime = new Date(posts[0].timestamp); // Index 0 is Oldest
                    if (pageOldestTime <= targetDate) {
                        console.log(`[Scrape] Target reached! (${pageOldestTime.toLocaleString()})`);
                        reachedTarget = true;
                    }
                }

                if (!batchHasPosts) {
                    // Batch empty? End of Gallery.
                    if (!reachedTarget) {
                        console.log(`[Scrape] End of Gallery ${currentGalleryId}. Target not reached (Gallery Too New).`);
                        galleryTooNew = true;
                    }
                    break;
                }
            }

            if (galleryTooNew || allPosts.length === 0) {
                // ** MIGRATE GALLERY **
                const match = currentGalleryId.match(/^([a-zA-Z0-9_]+?)(\d+)$/);
                if (match) {
                    const prefix = match[1];
                    const num = parseInt(match[2], 10);
                    if (num > 1) { // Can migrate down
                        const prevGalleryId = `${prefix}${num - 1}`;
                        console.log(`[Scrape] Switching Context: ${currentGalleryId} -> ${prevGalleryId}`);
                        currentGalleryId = prevGalleryId;
                        hops++;
                        continue;
                    }
                }
                if (hops > 0) break;
            }

            const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values());
            const relevantPosts = uniquePosts.filter(p => {
                const t = new Date(p.timestamp);
                return t >= targetDate && t <= targetEnd;
            });
            relevantPosts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            if (relevantPosts.length > 0) {
                console.log(`[Scrape] Success on ${currentGalleryId}. Found ${relevantPosts.length} posts.`);
                return res.status(200).json({ posts: relevantPosts, count: relevantPosts.length, galleryId: currentGalleryId });
            }

            // Reuse migration logic if empty range
            const match = currentGalleryId.match(/^([a-zA-Z0-9_]+?)(\d+)$/);
            if (match) {
                const prefix = match[1];
                const num = parseInt(match[2], 10);
                if (num > 1) {
                    const prevGalleryId = `${prefix}${num - 1}`;
                    console.log(`[Scrape] Range Empty. Trying prev gallery: ${prevGalleryId}`);
                    currentGalleryId = prevGalleryId;
                    hops++;
                    continue;
                }
            }

            break;

        } catch (error) {
            console.error('Single Scrape Logic Error:', error);
            break;
        }
    }

    return res.status(404).json({ error: 'No posts found in that time range after searching gallery history.' });
}
