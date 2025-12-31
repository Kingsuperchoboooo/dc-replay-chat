
import * as cheerio from 'cheerio';

/**
 * Parses the raw HTML of a DC Inside Gallery List page.
 * @param {string} htmlContent - The raw HTML string.
 * @returns {Array} - Array of post objects { id, title, author, date, timestamp }.
 */
export function parseDCList(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const posts = [];

  // Select rows in the gallery list table
  // Standard DC Inside structure: .gall_list tbody tr.us-post
  const rows = $('.gall_list tbody tr.us-post');

  rows.each((i, el) => {
    const row = $(el);

    // Extract ID (num)
    const id = row.find('.gall_num').text().trim();
    if (isNaN(parseInt(id))) return; // Skip notices/ads

    // Extract Title
    // usually in .gall_tit > a
    const titleLink = row.find('.gall_tit a').first();
    const title = titleLink.text().trim();

    // Extract Author & IP/ID
    const writerEl = row.find('.gall_writer');
    const author = writerEl.data('nick') || writerEl.text().trim();
    const ip = writerEl.data('ip') || ''; // e.g. "123.45"
    const uid = writerEl.data('uid') || ''; // Only for logged-in users

    // Extract Date/Time
    // The user noted: "hovering over the time (title attribute) shows seconds"
    const dateEl = row.find('.gall_date');
    const fullTime = dateEl.attr('title'); // e.g., "2023-10-10 18:30:45"
    const shortTime = dateEl.text().trim(); // e.g., "18:30" or "10.10"

    // If title attr is missing (maybe older posts/mobile view), fallback to shortTime
    // But for "Replay", fullTime is critical.
    if (fullTime) {
      posts.push({
        id,
        title,
        author,
        ip,
        uid,
        timestamp: fullTime, // strict ISO-ish format
        displayTime: shortTime
      });
    }
  });

  // Sort by time (oldest first)?
  // Usually the list is Newest First. We want Replay to go from Old -> New.
  // So we reverse it.
  return posts.reverse();
}
