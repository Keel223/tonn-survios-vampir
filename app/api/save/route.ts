import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function POST(req: Request) {
  try {
    const { tg_id, exp_earned } = await req.json();
    if (!tg_id || exp_earned === undefined) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    await redis.incrby(`player:${tg_id}:exp`, exp_earned);
    return NextResponse.json({ success: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
