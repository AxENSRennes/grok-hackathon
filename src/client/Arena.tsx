import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { Session } from './session';
import { WORLD, type PlayerView } from '../shared/protocol';
import { AVATAR_SIZE, AVATAR_FOOT_Y, drawAvatar } from './avatars';
import { drawArcadeQuestion, drawArcadeRoom } from './arcadeArt';

export type ArenaSource = Pick<Session, 'snapshot' | 'offset'>;
interface Visual { container: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Image; bubble: Phaser.GameObjects.Text; shadow: Phaser.GameObjects.Ellipse; x: number; y: number; signature: string }
class ArenaScene extends Phaser.Scene {
  private visuals = new Map<string, Visual>();
  private zoneKey = '';
  private zoneObjects: Phaser.GameObjects.GameObject[] = [];
  private floor!: Phaser.GameObjects.Graphics;
  private questionKey = '';
  private questionTexture!: Phaser.Textures.CanvasTexture;
  constructor(private session: ArenaSource, private reportFps: (fps: number) => void, private preview = false) { super('arena'); }
  create() {
    this.cameras.main.setBackgroundColor('#0a102b');
    const background = this.textures.createCanvas('arcade-room', WORLD.width, WORLD.height)!;
    drawArcadeRoom(background.getContext()); background.refresh();
    this.add.image(0, 0, 'arcade-room').setOrigin(0);
    this.floor = this.add.graphics();
    this.questionTexture = this.textures.createCanvas('arcade-question', WORLD.width, 190)!;
    this.add.image(0, 0, 'arcade-question').setOrigin(0).setDepth(2);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.reportFps(Math.round(this.game.loop.actualFps)) });
  }
  private texture(player: PlayerView, step = 0) {
    const key = `guest-${player.color}-${player.hair}-${player.accessory}-${player.accessory2 || 'none'}-${player.facing}-${step}`;
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, AVATAR_SIZE, AVATAR_SIZE)!;
      drawAvatar(texture.getContext(), player, { facing: player.facing, step });
      texture.refresh();
    }
    return key;
  }
  private addPlayer(player: PlayerView): Visual {
    const shadow = this.add.ellipse(0, 1, this.preview ? 67 : 39, 12, 0x080d24, 0.5);
    const sprite = this.add.image(0, 0, this.texture(player)).setOrigin(0.5, AVATAR_FOOT_Y / AVATAR_SIZE).setScale(this.preview ? 6 : 4);
    const bubble = this.add.text(0, -AVATAR_FOOT_Y * (this.preview ? 6 : 4) - 12, '', { fontFamily: 'monospace', fontSize: '16px', color: '#111831', backgroundColor: '#f1f5ff', padding: { x: 10, y: 8 }, wordWrap: { width: 210 }, align: 'center' }).setOrigin(0.5, 1).setVisible(false);
    const container = this.add.container(player.x, player.y, [shadow, sprite, bubble]);
    const visual = { container, shadow, sprite, bubble, x: player.x, y: player.y, signature: '' };
    this.visuals.set(player.id, visual); return visual;
  }
  update(_time: number, delta: number) {
    const state = this.session.snapshot;
    const question = state.question?.text || '';
    if (question !== this.questionKey) {
      this.questionKey = question; drawArcadeQuestion(this.questionTexture.getContext(), question); this.questionTexture.refresh();
    }
    const key = JSON.stringify([state.zones, state.phase, state.result]);
    if (key !== this.zoneKey) {
      this.zoneKey = key; this.floor.clear();
      this.zoneObjects.forEach(o => o.destroy()); this.zoneObjects = [];
      for (const zone of state.zones) {
        const color = Phaser.Display.Color.HexStringToColor(zone.color).color;
        this.floor.fillStyle(color, 0.12).fillRect(zone.x, zone.y, zone.width, zone.height);
        this.floor.lineStyle(4, color, 0.95).strokeRect(zone.x, zone.y, zone.width, zone.height);
        for (const x of [zone.x, zone.x + zone.width - 22]) for (const y of [zone.y, zone.y + zone.height - 4]) this.floor.fillStyle(color).fillRect(x, y, 22, 4);
        const count = state.result?.counts.find(c => c.id === zone.id)?.count;
        const text = this.add.text(zone.x + zone.width / 2, zone.y + 27, `${zone.label.toUpperCase()}${count === undefined ? '' : ` · ${count}`}`, { fontFamily: 'monospace', fontSize: this.preview ? '32px' : '26px', color: '#f1f5ff', fontStyle: 'bold', align: 'center', stroke: '#101731', strokeThickness: 4, wordWrap: { width: zone.width - 24 } }).setOrigin(0.5, 0).setDepth(1);
        this.zoneObjects.push(text);
      }
    }
    const present = new Set<string>();
    const now = Date.now() + this.session.offset;
    for (const player of state.players) {
      if (!player.online) continue;
      present.add(player.id);
      const v = this.visuals.get(player.id) || this.addPlayer(player);
      // Small, bounded visual extrapolation and frame-rate independent smoothing.
      const age = Math.min(45, Math.max(0, now - state.serverTime)) / 1000;
      const targetX = Phaser.Math.Clamp(player.x + player.vx * age, WORLD.left + 14, WORLD.right - 14);
      const targetY = Phaser.Math.Clamp(player.y + player.vy * age, WORLD.top + 14, WORLD.bottom - 14);
      const blend = 1 - Math.exp(-Math.min(delta, 50) / 28);
      v.x += (targetX - v.x) * blend; v.y += (targetY - v.y) * blend;
      v.container.setPosition(Math.round(v.x), Math.round(v.y)).setDepth(10 + v.y);
      const jumpT = (now - player.jumpAt) / 620;
      const jump = jumpT > 0 && jumpT < 1 ? Math.sin(jumpT * Math.PI) * 38 : 0;
      const moving = Math.hypot(player.vx, player.vy) > 15;
      const step = moving ? [0, 1, 0, 2][Math.floor(now / 135) % 4] : 0;
      v.sprite.setY(-Math.round(jump));
      v.shadow.setScale(1 - jump / 100);
      const signature = `${player.color}:${player.hair}:${player.accessory}:${player.accessory2 || 'none'}:${player.facing}:${step}`;
      if (v.signature !== signature) { v.sprite.setTexture(this.texture(player, step)); v.signature = signature; }
      const showBubble = state.chatEnabled && player.messageUntil > now && !!player.message;
      v.bubble.setY(-AVATAR_FOOT_Y * (this.preview ? 6 : 4) - 12 - Math.round(jump));
      v.bubble.setVisible(showBubble);
      if (showBubble) v.bubble.setText(player.message);
    }
    for (const [id, v] of this.visuals) if (!present.has(id)) { v.container.destroy(); this.visuals.delete(id); }
  }
}

export function Arena({ session, onFps, preview = false }: { session: ArenaSource; onFps: (fps: number) => void; preview?: boolean }) {
  const element = useRef<HTMLDivElement>(null);
  const report = useRef(onFps); report.current = onFps;
  useEffect(() => {
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: element.current!, width: WORLD.width, height: WORLD.height,
      pixelArt: true, roundPixels: true, antialias: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: new ArenaScene(session, fps => report.current(fps), preview),
      banner: false, audio: { noAudio: true },
    });
    return () => game.destroy(true);
  }, [session, preview]);
  return <div className="arena" ref={element} aria-label="Live multiplayer arena" />;
}
