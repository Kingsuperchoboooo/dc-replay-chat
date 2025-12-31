
import { parseDCList } from '@/lib/parser';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb', // Allow large HTML files
        },
    },
};

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { html } = req.body;

        if (!html) {
            return res.status(400).json({ message: 'No HTML content provided' });
        }

        const posts = parseDCList(html);

        return res.status(200).json({ posts });
    } catch (error) {
        console.error('Parsing error:', error);
        return res.status(500).json({ message: 'Failed to parse HTML' });
    }
}
