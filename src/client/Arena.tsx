import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { Session } from './session';
import { WORLD, type PlayerView } from '../shared/protocol';
import { drawAvatar } from './avatars';

interface Visual { container: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; bubble: Phaser.GameObjects.Text; shadow: Phaser.GameObjects.Ellipse; x: number; y: number; signature: string }
class ArenaScene extends Phaser.Scene {
  private visuals = new Map<string, Visual>();
  private zoneKey = '';
  private zoneObjects: Phaser.GameObjects.GameObject[] = [];
  private floor!: Phaser.GameObjects.Graphics;
  constructor(private session: Session, private reportFps: (fps: number) => void) { super('arena'); }
  create() {
    this.cameras.main.setBackgroundColor('#a0b7a0');
    const g = this.add.graphics();
    g.fillStyle(0x314d40).fillRect(24, 24, 1232, 712);
    g.fillStyle(0xd8c7a0).fillRect(40, 40, 1200, 680);
    for (let y = 40; y < 720; y += 32) {
      g.lineStyle(1, 0xb8a47d, 0.6).lineBetween(40, y, 1240, y);
      for (let x = 40 + ((y / 32) % 2) * 64; x < 1240; x += 128) g.lineBetween(x, y, x, Math.min(y + 32, 720));
    }
    g.fillStyle(0x557c67).fillRect(60, 48, 1160, 145);
    g.fillStyle(0x304c40).fillRect(80, 180, 1120, 16);
    for (const x of [80, 1200]) {
      g.fillStyle(0x56684e).fillRect(x - 13, 86, 26, 32);
      g.fillStyle(0x88a778).fillRect(x - 20, 54, 40, 40);
      g.fillStyle(0xa1b98b).fillRect(x - 12, 46, 26, 22);
    }
    this.floor = this.add.graphics();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.reportFps(Math.round(this.game.loop.actualFps)) });
  }
  private texture(player: PlayerView) {
    const key = `guest-${player.color}-${player.hair}-${player.accessory}`;
    if (!this.textures.exists(key)) {
      const texture = this.textures.createCanvas(key, 24, 32)!;
      drawAvatar(texture.getContext(), player);
      texture.refresh();
    }
    return key;
  }
  private addPlayer(player: PlayerView): Visual {
    const shadow = this.add.ellipse(0, 1, 31, 10, 0x23392d, 0.22);
    const sprite = this.add.image(0, 0, this.texture(player)).setOrigin(0.5, 1).setScale(2);
    const label = this.add.text(0, 8, player.name, { fontFamily: 'monospace', fontSize: '14px', color: '#263d32', backgroundColor: '#f3edd8', padding: { x: 4, y: 2 } }).setOrigin(0.5, 0);
    const bubble = this.add.text(0, -77, '', { fontFamily: 'monospace', fontSize: '16px', color: '#263d32', backgroundColor: '#fff9e9', padding: { x: 10, y: 8 }, wordWrap: { width: 210 }, align: 'center' }).setOrigin(0.5, 1).setVisible(false);
    const container = this.add.container(player.x, player.y, [shadow, sprite, label, bubble]);
    const visual = { container, shadow, sprite, label, bubble, x: player.x, y: player.y, signature: '' };
    this.visuals.set(player.id, visual); return visual;
  }
  update(_time: number, delta: number) {
    const state = this.session.snapshot;
    const key = JSON.stringify([state.zones, state.phase, state.result]);
    if (key !== this.zoneKey) {
      this.zoneKey = key; this.floor.clear();
      this.zoneObjects.forEach(o => o.destroy()); this.zoneObjects = [];
      for (const zone of state.zones) {
        const color = Phaser.Display.Color.HexStringToColor(zone.color).color;
        this.floor.fillStyle(color, 0.62).fillRect(zone.x, zone.y, zone.width, zone.height);
        this.floor.lineStyle(3, color, 0.9).strokeRect(zone.x, zone.y, zone.width, zone.height);
        const count = state.result?.counts.find(c => c.id === zone.id)?.count;
        const text = this.add.text(zone.x + zone.width / 2, zone.y + 18, `${zone.label}${count === undefined ? '' : ` · ${count}`}`, { fontFamily: 'monospace', fontSize: '20px', color: '#24382e', fontStyle: 'bold', align: 'center', wordWrap: { width: zone.width - 20 } }).setOrigin(0.5, 0).setDepth(1);
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
      const walk = Math.hypot(player.vx, player.vy) > 15 ? Math.sin(now / 75) * 2 : 0;
      v.sprite.setY(-jump - Math.abs(walk));
      v.sprite.setFlipX(player.facing === 'left');
      v.shadow.setScale(1 - jump / 100);
      const signature = `${player.color}:${player.hair}:${player.accessory}`;
      if (v.signature !== signature) { v.sprite.setTexture(this.texture(player)); v.signature = signature; }
      const showBubble = state.chatEnabled && player.messageUntil > now && !!player.message;
      v.bubble.setVisible(showBubble);
      if (showBubble) v.bubble.setText(player.message);
    }
    for (const [id, v] of this.visuals) if (!present.has(id)) { v.container.destroy(); this.visuals.delete(id); }
  }
}

export function Arena({ session, onFps }: { session: Session; onFps: (fps: number) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const report = useRef(onFps); report.current = onFps;
  useEffect(() => {
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: element.current!, width: WORLD.width, height: WORLD.height,
      pixelArt: true, roundPixels: true, antialias: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: new ArenaScene(session, fps => report.current(fps)),
      banner: false, audio: { noAudio: true },
    });
    return () => game.destroy(true);
  }, [session]);
  return <div className="arena" ref={element} aria-label="Live multiplayer arena" />;
}
