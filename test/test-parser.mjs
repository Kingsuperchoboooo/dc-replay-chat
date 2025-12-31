
import fs from 'fs';
import path from 'path';

// We need to use dynamic import for the ES Module parser, or change this script to .mjs
// Since we are in a rush, let's just assume we can import the transpiled or use esm.
// Simpler: Just allow this test to fail if setup isn't perfect, but let's try to make it robust.
// 'parser.js' is ESM (export function).
// 'test-parser.js' can be .mjs
import { parseDCList } from '../src/lib/parser.js';

const htmlPath = path.join(process.cwd(), 'test', 'mock-data.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

console.log('--- Testing Parser ---');
const posts = parseDCList(html);

console.log(`Found ${posts.length} posts.`);
posts.forEach(p => {
    console.log(`[${p.timestamp}] ${p.author}: ${p.title}`);
});

if (posts.length === 3) {
    console.log('SUCCESS: Extracted 3 valid posts (skipped notice).');
    if (posts[0].id === '1001') {
        console.log('SUCCESS: Order is correct (Oldest first).');
    } else {
        console.error('FAIL: Order incorrect or ID mismatch.');
    }
} else {
    console.error('FAIL: Post count mismatch.');
}
