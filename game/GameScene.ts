import Phaser from 'phaser';

// ЗАЩИТА ОТ СЕРВЕРНОГО РЕНДЕРА: Если мы на сервере, ничего не делаем
if (typeof window === 'undefined') {
  // @ts-ignore
  module.exports = { GameScene: class {} };
} else {

export class GameScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  monsters!: Phaser.Physics.Arcade.Group;
  exp: number = 0;
  expText!: Phaser.GameObjects.Text;
  isDead: boolean = false;

  constructor() { super({ key: 'GameScene' }); }

  create() {
    this.exp = 0;
    this.isDead = false;

    const gfxPlayer = this.add.graphics();
    gfxPlayer.fillStyle(0xff0000, 1); gfxPlayer.fillRect(0, 0, 16, 16);
    gfxPlayer.generateTexture('player', 16, 16); gfxPlayer.destroy();

    const gfxMob = this.add.graphics();
    gfxMob.fillStyle(0x00ff00, 1); gfxMob.fillRect(0, 0, 12, 12);
    gfxMob.generateTexture('monster', 12, 12); gfxMob.destroy();

    this.player = this.physics.add.sprite(180, 320, 'player');
    this.player.setCollideWorldBounds(true); this.player.setScale(2);

    this.monsters = this.physics.add.group();
    this.time.addEvent({ delay: 800, callback: this.spawnMonster, callbackScope: this, loop: true });

    this.expText = this.add.text(10, 10, 'EXP: 0', { fontSize: '18px', color: '#fff', fontStyle: 'bold' });
    
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDead && pointer.isDown) this.physics.moveToObject(this.player, pointer, 200);
    });

    this.physics.add.overlap(this.player, this.monsters, this.playerHit, undefined, this);
  }

  update() {
    if (this.isDead) return;
    this.monsters.getChildren().forEach((mob) => {
      this.physics.moveToObject(mob as Phaser.Physics.Arcade.Sprite, this.player, 60);
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, mob.x, mob.y);
      if (dist < 40) {
        mob.destroy();
        this.exp += 10;
        this.expText.setText('EXP: ' + this.exp);
      }
    });
  }

  spawnMonster() {
    if (this.isDead) return;
    const x = Phaser.Math.Between(0, 360); const y = Phaser.Math.Between(0, 640);
    const mob = this.physics.add.sprite(x, y, 'monster');
    this.monsters.add(mob);
  }

  playerHit() {
    if (this.isDead) return;
    this.isDead = true;
    this.player.setTint(0x000000);
    this.physics.pause();
    if (this.game.registry.get('onGameEnd')) {
      this.game.registry.get('onGameEnd')(this.exp);
    }
  }
}

} // Закрывающая скобка защиты от серверного рендера
