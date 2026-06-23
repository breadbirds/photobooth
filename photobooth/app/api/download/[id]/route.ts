import { NextResponse } from 'next/server';
import { createClient } from 'redis';

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

type PhotoData = {
    image: string;
    contentType: string;
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

export async function GET(_request: Request, context: RouteContext) {
    const { id } = await context.params;
    const photoKey = `photo:${id}`;

    try {
        const redis = await getRedisClient();
        const photoJson = await redis.get(photoKey);

        if (!photoJson) {
            return new NextResponse(null, { status: 404 });
        }

        const photo = JSON.parse(photoJson) as PhotoData;

        // Extract base64 from data URL
        const base64Match = photo.image.match(/^data:image\/jpeg;base64,(.+)$/);
        if (!base64Match) {
            return new NextResponse(null, { status: 400 });
        }

        const buffer = Buffer.from(base64Match[1], 'base64');

        return new NextResponse(new Blob([buffer], { type: photo.contentType }), {
            headers: {
                'Content-Type': photo.contentType,
                'Content-Disposition': `attachment; filename="photobooth-${id}.jpg"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('Failed to retrieve photo from Redis:', error);
        return new NextResponse(null, { status: 500 });
    }
}
