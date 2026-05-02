import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const ADMIN_ID = 6188749367; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, tg_id, exp_earned, amount, destination_address, request_id, upstash_url, upstash_token } = body;

    if (!upstash_url || !upstash_token) return NextResponse.json({ error: 'DB config missing' }, { status: 400 });
    const redis = new Redis({ url: upstash_url, token: upstash_token });

    if (action === 'save_exp') {
      await redis.incrby(`player:${tg_id}:exp`, exp_earned);
      return NextResponse.json({ success: true });
    }

    if (action === 'withdraw_request') {
      const currentBalance = Number(await redis.get(`player:${tg_id}:ton`) || 0);
      if (currentBalance < amount) return NextResponse.json({ error: 'Not enough TON' }, { status: 400 });
      await redis.incrbyfloat(`player:${tg_id}:ton`, -amount);
      const request = { id: `w_${Date.now()}`, tg_id: String(tg_id), amount: String(amount), address: destination_address };
      await redis.rpush('withdraw_requests', JSON.stringify(request));
      return NextResponse.json({ success: true });
    }

    if (action === 'get_withdrawals') {
      if (tg_id !== ADMIN_ID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const reqsStr = await redis.lrange('withdraw_requests', 0, -1);
      const reqs = reqsStr.map(r => JSON.parse(r));
      return NextResponse.json({ success: true, requests: reqs });
    }

    if (action === 'mark_paid') {
      if (tg_id !== ADMIN_ID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const reqsStr = await redis.lrange('withdraw_requests', 0, -1);
      const reqs = reqsStr.map(r => JSON.parse(r));
      const targetReq = reqs.find(r => r.id === request_id);
      if (!targetReq) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

      const { TonClient, WalletContractV4, internal } = await import('@ton/ton');
      const { mnemonicToPrivateKey } = await import('@ton/crypto');
      const mnemonic = process.env.HOT_WALLET_MNEMONIC?.split(' ');
      if (!mnemonic || mnemonic.length < 24) throw new Error('Mnemonic not set on Vercel');

      const keyPair = await mnemonicToPrivateKey(mnemonic);
      const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
      const client = new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC' });
      const contract = client.open(wallet);
      const seqno = await contract.getSeqno();
      const amountNano = BigInt(Math.floor((Number(targetReq.amount) - 0.05) * 1e9)); 
      const transfer = contract.createTransfer({ seqno, secretKey: keyPair.secretKey, messages: [internal({ to: targetReq.address, value: amountNano, bounce: false })] });
      await contract.send(transfer);

      const updated = reqs.filter(r => r.id !== request_id);
      const pipeline = redis.pipeline();
      pipeline.del('withdraw_requests');
      if (updated.length > 0) updated.forEach(r => pipeline.rpush('withdraw_requests', JSON.stringify(r)));
      await pipeline.exec();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
