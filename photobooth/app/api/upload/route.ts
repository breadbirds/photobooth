import { NextResponse } from 'next/server';
import { createClient } from 'redis';

const JPEG_PREFIX = 'data:image/jpeg;base64,';

type UploadRequest = {
    image?: unknown;
};

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({ url: process.env.REDIS_URL });
        redisClient.on('error', (err) => console.error('Redis error:', err));
        await redisClient.connect();
    }
    return redisClient;
}

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as UploadRequest | null;

    if (typeof body?.image !== 'string' || !body.image.startsWith(JPEG_PREFIX)) {
        return new NextResponse(null, { status: 400 });
    }

    const base64 = body.image.slice(JPEG_PREFIX.length);
    const buffer = Buffer.from(base64, 'base64');

    if (buffer.length === 0) {
        return new NextResponse(null, { status: 400 });
    }

    const photoId = crypto.randomUUID();
    const photoKey = `photo:${photoId}`;

    try {
        const redis = await getRedisClient();
        await redis.setEx(
            photoKey,
            30, // TTL: 30 seconds
            JSON.stringify({
                image: `data:image/jpeg;base64,${base64}`,
                contentType: 'image/jpeg',
            })
        );
    } catch (error) {
        console.error('Failed to store photo in Redis:', error);
        return new NextResponse(null, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    return NextResponse.json({ url: `${origin}/api/download/${photoId}` });
}
