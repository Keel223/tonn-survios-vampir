'use client';

import { useEffect, useState, useCallback } from 'react';
import { Game } from 'phaser';
import { GameScene } from '../../game/GameScene'; // ПРЯМОЙ ПУТЬ
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';

const ADMIN_ID = 6188749367;

// ... остальной код page.tsx оставьте без изменений! ...

export default function Home() {
  const [gameInstance, setGameInstance] = useState<Game | null>(null);
  const [tonUI] = useTonConnectUI();
  const rawAddress = useTonAddress(false);
  
  const [tgId, setTgId] = useState<number>(0);
  const [exp, setExp] = useState<number>(0);
  const [tonBalance, setTonBalance] = useState<number>(0);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'dead'>('menu');

  // Админка
  const [showAdmin, setShowAdmin] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    const fetchInitData = async () => {
      let id = 0;
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        const tg = (window as any).Telegram.WebApp;
        tg.ready();
        id = tg.initDataUnsafe?.user?.id || 0;
      } else {
        id = 999999; // Заглушка для локального запуска
      }
      setTgId(id);
      // Здесь должен быть запрос к вашему API для получения баланса из Upstash
    };
    fetchInitData();
  }, []);

  const startGame = useCallback(() => {
    if (gameInstance) gameInstance.destroy(true);

    const onGameEnd = async (earnedExp: number) => {
      if (earnedExp > 0) {
        await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tg_id: tgId, exp_earned: earnedExp })
        });
        setExp(prev => prev + earnedExp);
      }
      setGameState('dead');
    };

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 360,
      height: 640,
      parent: 'game-container',
      backgroundColor: '#1a1a2e',
      physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
      scene: new GameScene(onGameEnd),
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      callbacks: { postBoot: (game) => { game.registry.set('onGameEnd', onGameEnd); } }
    };

    setGameInstance(new Game(config));
    setGameState('playing');
  }, [tgId, gameInstance]);

  const topUp = (amount: number) => {
    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 60,
      messages: [{ address: "UQD1gupv0Z0UPnKKYENmerBA526cCiNvhdr4VO0LofATa8v6", amount: (amount * 1000000000).toString(), comment: `deposit_${tgId}` }] // Вставьте ваш TON адрес
    };
    tonUI.sendTransaction(transaction);
  };

  const withdrawRequest = async (amount: number) => {
    if (!rawAddress) { tonUI.openModal(); return; }
    if (tonBalance < amount) return alert('Недостаточно TON');
    
    const res = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'withdraw_request', tg_id: tgId, amount, destination_address: rawAddress })
    });
    const data = await res.json();
    if (data.success) {
      setTonBalance(prev => prev - amount);
      alert('Заявка создана! Ожидайте выплаты.');
    } else { alert(data.error); }
  };

  // Админские функции
  const loadWithdrawals = async () => {
    const res = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_withdrawals', tg_id: tgId })
    });
    const data = await res.json();
    if (data.success) setWithdrawals(data.requests);
  };

  const handleMarkPaid = async (requestId: string) => {
    if (!confirm('Вы действительно отправили TON этому игроку?')) return;
    const res = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid', tg_id: tgId, request_id: requestId })
    });
    const data = await res.json();
    if (data.success) {
      alert('TON успешно отправлены в блокчейн!');
      loadWithdrawals();
    } else { alert('Ошибка: ' + data.error); }
  };

  return (
    <div className="relative w-[360px] h-[640px] bg-gray-800 flex flex-col overflow-hidden mx-auto">
      <div id="game-container" className="absolute inset-0 z-0"></div>

      {/* Игровой UI */}
      <div className="absolute top-0 left-0 right-0 p-2 bg-black/50 z-10 flex justify-between items-center">
        <div>
          <p className="text-yellow-400 font-bold text-sm">EXP: {exp}</p>
          <p className="text-blue-400 font-bold text-sm">TON: {tonBalance.toFixed(2)}</p>
        </div>
        <button onClick={() => rawAddress ? tonUI.disconnect() : tonUI.openModal()} className="bg-blue-600 px-2 py-1 rounded text-xs">
          {rawAddress ? 'Кошелек ✓' : 'Подключить'}
        </button>
      </div>

      {/* Экран меню/смерти */}
      {gameState !== 'playing' && (
        <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center gap-4 p-4">
          <h1 className="text-2xl font-bold text-red-500">Vampire Survivors</h1>
          <button onClick={startGame} className="bg-green-600 hover:bg-green-700 w-full py-2 rounded font-bold">
            {gameState === 'dead' ? 'Играть снова' : 'Начать игру'}
          </button>

          <div className="flex gap-2 w-full">
            <button onClick={() => topUp(1)} className="bg-blue-600 px-3 py-1 rounded text-sm flex-1">+1 TON</button>
            <button onClick={() => withdrawRequest(1)} className="bg-red-600 px-3 py-1 rounded text-sm flex-1">Вывести 1 TON</button>
          </div>

          {/* АДМИНКА (Видна только вам) */}
          {tgId === ADMIN_ID && (
            <div className="w-full border-t border-white/20 pt-4 mt-2">
              <button onClick={() => { setShowAdmin(!showAdmin); loadWithdrawals(); }} className="bg-red-800 w-full py-2 rounded font-bold text-sm">
                🛠 АДМИН-ПАНЕЛЬ
              </button>
              
              {showAdmin && (
                <div className="mt-2 max-h-40 overflow-y-auto">
                  {withdrawals.length === 0 ? <p className="text-xs text-center text-gray-400">Нет заявок</p> : 
                    withdrawals.map(req => (
                      <div key={req.id} className="bg-gray-700 p-2 rounded mb-2 text-xs">
                        <p>Игрок: {req.tg_id} | Сумма: {req.amount} TON</p>
                        <p className="text-blue-300 truncate">Адрес: {req.address}</p>
                        <button onClick={() => handleMarkPaid(req.id)} className="bg-green-700 w-full mt-1 py-1 rounded text-[10px]">
                          Выплатить TON автоматически
                        </button>
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
