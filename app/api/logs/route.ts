import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    const body = await req.json();
    const { level, message, context, traceId } = body;

    const userId = session?.user?.id;

    switch (level?.toUpperCase()) {
      case 'DEBUG':
        logger.debug(message, context, userId, traceId);
        break;
      case 'INFO':
        logger.info(message, context, userId, traceId);
        break;
      case 'WARN':
        logger.warn(message, context, userId, traceId);
        break;
      case 'ERROR':
        logger.error(message, body.error, context, userId, traceId);
        break;
      default:
        logger.info(`[Client] ${message}`, context, userId, traceId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to record client log', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
