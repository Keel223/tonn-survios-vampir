'use client';

import { useEffect, useState, useCallback } from 'react';
import { Game } from 'phaser';
import Phaser from 'phaser';
import { TonConnectUIProvider, useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';

// ============ НАСТРОЙКИ ============
const ADMIN_ID = 6188749367; 
const TON_WALLET_DEPOSIT = "UQD1gupv0Z0UPnKKYENmerBA526cCiNvhdr4VO0LofATa8v6"; // ВАШ КОШЕЛЕК ДЛЯ ПОПОЛНЕНИЙ
const UPSTASH_URL = "https://willing-cicada-111832.upstash.io"; 
const UPSTASH_TOKEN = "gQAAAAAAAbTYAAIgcDE3OWExNWY2NTdkMTk0NDE1ODA3YzNiY2Y5OThkYTYwYg"; 
// ===================================

// --- ИГРА PHASER ---
class GameScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  monsters!: Phaser.Physics.Arcade.Group;
  exp: number = 0;
  expText!: Phaser.GameObjects.Text;
  isDead: boolean = false;

  constructor() { super({ key: 'GameScene' }); }

  create() {
    this.exp = 0; this.isDead = false;
    const g1 = this.add.graphics(); g1.fillStyle(0xff0000, 1); g1.fillRect(0,0,16,16); g1.generateTexture('player',16,16); g1.destroy();
    const g2 = this.add.graphics(); g2.fillStyle(0x00ff00, 1); g2.fillRect(0,0,12,12); g2.generateTexture('monster',12,12); g2.destroy();

    this.player = this.physics.add.sprite(180, 320, 'player');
    this.player.setCollideWorldBounds(true); this.player.setScale(2);
    this.monsters = this.physics.add.group();
    this.time.addEvent({ delay: 800, callback: this.spawnMonster, callbackScope: this, loop: true });
    this.expText = this.add.text(10, 10, 'EXP: 0', { fontSize: '18px', color: '#fff' });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (!this.isDead && p.isDown) this.physics.moveToObject(this.player, p, 200); });
    this.physics.add.overlap(this.player, this.monsters, () => { if(!this.isDead){ this.isDead=true; this.player.setTint(0x000000); this.physics.pause(); if(this.game.registry.get('onGameEnd')) this.game.registry.get('onGameEnd')(this.exp); }}, undefined, this);
  }

  update() {
    if (this.isDead) return;
    this.monsters.getChildren().forEach((mob) => {
      this.physics.moveToObject(mob as Phaser.Physics.Arcade.Sprite, this.player, 60);
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, mob.x, mob.y) < 40) { mob.destroy(); this.exp+=10; this.expText.setText('EXP: '+this.exp); }
    });
  }

  spawnMonster() { if(this.isDead) return; this.monsters.add(this.physics.add.sprite(Phaser.Math.Between(0,360), Phaser.Math.Between(0,640), 'monster')); }
}

// --- ОСНОВНОЕ ПРИЛОЖЕНИЕ ---
function GameApp() {
  const [gameInstance, setGameInstance] = useState<Game | null>(null);
  const [tonUI] = useTonConnectUI();
  const rawAddress = useTonAddress(false);
  const [tgId, setTgId] = useState<number>(0);
  const [exp, setExp] = useState<number>(0);
  const [tonBalance, setTonBalance] = useState<number>(0);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'dead'>('menu');
  const [showAdmin, setShowAdmin] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    let id = 0;
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp; tg.ready(); id = tg.initDataUnsafe?.user?.id || 0;
    } else { id = 999999; }
    setTgId(id);
  }, []);

  const startGame = useCallback(() => {
    if (gameInstance) gameInstance.destroy(true);
    const onGameEnd = async (earnedExp: number) => {
      if (earnedExp > 0) {
        await fetch('/api', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'save_exp', tg_id: tgId, exp_earned: earnedExp, upstash_url: UPSTASH_URL, upstash_token: UPSTASH_TOKEN }) });
        setExp(prev => prev + earnedExp);
      }
      setGameState('dead');
    };
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO, width: 360, height: 640, parent: 'game-container', backgroundColor: '#1a1a2e',
      physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
      scene: new GameScene(onGameEnd), scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      callbacks: { postBoot: (game) => { game.registry.set('onGameEnd', onGameEnd); } }
    };
    setGameInstance(new Game(config)); setGameState('playing');
  }, [tgId, gameInstance]);

  const topUp = (amount: number) => {
    tonUI.sendTransaction({ validUntil: Math.floor(Date.now()/1000)+60, messages: [{ address: TON_WALLET_DEPOSIT, amount: (amount*1e9).toString(), comment: `deposit_${tgId}` }] });
  };

  const withdrawRequest = async (amount: number) => {
    if (!rawAddress) { tonUI.openModal(); return; }
    if (tonBalance < amount) return alert('Недостаточно TON');
    const res = await fetch('/api', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'withdraw_request', tg_id: tgId, amount, destination_address: rawAddress, upstash_url: UPSTASH_URL, upstash_token: UPSTASH_TOKEN }) });
    const data = await res.json();
    if (data.success) { setTonBalance(prev => prev - amount); alert('Заявка создана!'); } else { alert(data.error); }
  };

  const loadWithdrawals = async () => {
    const res = await fetch('/api', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'get_withdrawals', tg_id: tgId, upstash_url: UPSTASH_URL, upstash_token: UPSTASH_TOKEN }) });
    const data = await res.json(); if (data.success) setWithdrawals(data.requests);
  };

  const handleMarkPaid = async (requestId: string) => {
    if (!confirm('Подтвердить отправку TON?')) return;
    const res = await fetch('/api', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'mark_paid', tg_id: tgId, request_id: requestId, upstash_url: UPSTASH_URL, upstash_token: UPSTASH_TOKEN }) });
    const data = await res.json(); if (data.success) { alert('TON отправлены!'); loadWithdrawals(); } else { alert('Ошибка: '+data.error); }
  };

  return (
    <div className="relative w-[360px] h-[640px] bg-gray-800 flex flex-col overflow-hidden mx-auto">
      <div id="game-container" className="absolute inset-0 z-0"></div>
      <div className="absolute top-0 left-0 right-0 p-2 bg-black/50 z-10 flex justify-between items-center">
        <div>
          <p className="text-yellow-400 font-bold text-sm">EXP: {exp}</p>
          <p className="text-blue-400 font-bold text-sm">TON: {tonBalance.toFixed(2)}</p>
        </div>
        <button onClick={() => rawAddress ? tonUI.disconnect() : tonUI.openModal()} className="bg-blue-600 px-2 py-1 rounded text-xs">
          {rawAddress ? 'Кошелек ✓' : 'Подключить'}
        </button>
      </div>

      {gameState !== 'playing' && (
        <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center gap-4 p-4">
          <h1 className="text-2xl font-bold text-red-500">Vampire Survivors</h1>
          <button onClick={startGame} className="bg-green-600 hover:bg-green-700 w-full py-2 rounded font-bold">
            {gameState === 'dead' ? 'Играть снова' : 'Начать игру'}
          </button>
          <div className="flex gap-2 w-full">
            <button onClick={() => topUp(1)} className="bg-blue-600 px-3 py-1 rounded text-sm flex-1">+1 TON</button>
            <button onClick={() => withdrawRequest(1)} className="bg-red-600 px-3 py-1 rounded text-sm flex-1">Вывести</button>
          </div>

          {tgId === ADMIN_ID && (
            <div className="w-full border-t border-white/20 pt-4 mt-2">
              <button onClick={() => { setShowAdmin(!showAdmin); loadWithdrawals(); }} className="bg-red-800 w-full py-2 rounded font-bold text-sm">🛠 АДМИНКА</button>
              {showAdmin && (
                <div className="mt-2 max-h-40 overflow-y-auto">
                  {withdrawals.length === 0 ? <p className="text-xs text-center text-gray-400">Нет заявок</p> : 
                    withdrawals.map(req => (
                      <div key={req.id} className="bg-gray-700 p-2 rounded mb-2 text-xs">
                        <p>Игрок: {req.tg_id} | Сумма: {req.amount} TON</p>
                        <p className="text-blue-300 truncate">Адрес: {req.address}</p>
                        <button onClick={() => handleMarkPaid(req.id)} className="bg-green-700 w-full mt-1 py-1 rounded text-[10px]">Выплатить TON</button>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- ГЛАВНЫЙ ЭКСПОРТ ---
export default function Home() {
  return (
    <TonConnectUIProvider manifestUrl="https://raw.githubusercontent.com/ton-connect/manifest-demo/main/tonconnect-manifest.json">
      <GameApp />
    </TonConnectUIProvider>
  );
}
