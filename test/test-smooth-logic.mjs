
console.log('--- Testing Smooth Replay Logic ---');

// Duplicate of logic in index.js for verification
const preprocessPosts = (rawPosts) => {
    const groups = {};
    rawPosts.forEach((post) => {
        const key = post.timestamp;
        if (!groups[key]) groups[key] = [];
        groups[key].push(post);
    });

    const processed = [];
    Object.values(groups).forEach((group) => {
        const count = group.length;
        if (count === 1) {
            const post = group[0];
            post.virtualTimestamp = new Date(post.timestamp).getTime();
            processed.push(post);
        } else {
            const interval = 1000 / count;
            group.forEach((post, index) => {
                const baseTime = new Date(post.timestamp).getTime();
                post.virtualTimestamp = baseTime + (interval * index);
                processed.push(post);
            });
        }
    });

    return processed.sort((a, b) => a.virtualTimestamp - b.virtualTimestamp);
};

// Test Data
const rawPosts = [
    { id: '1', timestamp: '2023-11-01 12:00:00' }, // Group 1 (5 items)
    { id: '2', timestamp: '2023-11-01 12:00:00' },
    { id: '3', timestamp: '2023-11-01 12:00:00' },
    { id: '4', timestamp: '2023-11-01 12:00:00' },
    { id: '5', timestamp: '2023-11-01 12:00:00' },
    { id: '6', timestamp: '2023-11-01 12:00:01' }  // Group 2 (1 item)
];

const result = preprocessPosts(rawPosts);

console.log(`Total processed posts: ${result.length}`);

// Verify offsets
const group1 = result.filter(p => p.timestamp === '2023-11-01 12:00:00');
console.log(`Group 1 size: ${group1.length}`);

group1.forEach((p, i) => {
    const expectedOffset = i * 200; // 1000ms / 5 = 200ms
    const actualOffset = p.virtualTimestamp - new Date(p.timestamp).getTime();
    console.log(`Post ${p.id}: Offset ${actualOffset}ms (Expected ${expectedOffset}ms)`);
    if (Math.abs(actualOffset - expectedOffset) > 1) {
        console.error('FAIL: Offset mismatch');
        process.exit(1);
    }
});

console.log('SUCCESS: Offsets are correct.');
