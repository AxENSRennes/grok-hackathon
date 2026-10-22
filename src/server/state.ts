import { schema, t } from '@colyseus/schema';

export class PlayerState extends schema({
  id: t.string().default(''), name: t.string().default(''),
  x: t.float32().default(0), y: t.float32().default(0),
  vx: t.float32().default(0), vy: t.float32().default(0),
  color: t.uint8().default(0), hair: t.uint8().default(0),
  accessory: t.string().default('none'), facing: t.string().default('down'),
  jumpAt: t.float64().default(0), message: t.string().default(''),
  messageUntil: t.float64().default(0), online: t.boolean().default(true),
  lastSeq: t.number().default(-1),
}, 'PlayerState') {}

export class PartyState extends schema({
  players: t.map(PlayerState),
  phase: t.string().default('lobby'), questionJson: t.string().default(''),
  zonesJson: t.string().default('[]'), resultJson: t.string().default(''),
  endsAt: t.float64().default(0), serverTime: t.float64().default(() => Date.now()),
  paused: t.boolean().default(false), chatEnabled: t.boolean().default(true),
}, 'PartyState') {}
