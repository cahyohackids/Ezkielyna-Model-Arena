import { approach, clamp, overlap } from './utils.js';
export const PHYSICS = Object.freeze({ speed: 226, acceleration: 1850, airAcceleration: 1390, friction: 2100, airFriction: 650, gravity: 1100, fallGravity: 1720, terminal: 690, jump: 470, coyote: .12, buffer: .13, dashSpeed: 590, dashTime: .145, dashCooldown: .78 });
export class Player {
  constructor(spawn) { this.w = 22; this.h = 30; this.health = 3; this.reset(spawn); }
  reset(spawn) {
    this.x = spawn.x; this.y = spawn.y; this.vx = 0; this.vy = 0; this.facing = 1;
    this.grounded = false; this.standing = null; this.coyote = 0; this.buffer = 0;
    this.dash = 0; this.cooldown = 0; this.invulnerable = 0; this.stun = 0; this.squash = 0;
    this.run = 0; this.dead = false; this.state = 'idle'; this.trail = []; this.jumpCut = false;
  }
  jump(events, strength = PHYSICS.jump) {
    this.vy = -strength; this.grounded = false; this.standing = null; this.coyote = 0; this.buffer = 0;
    this.squash = -.3; this.jumpCut = strength > 500; events.push({ type: strength > 500 ? 'bounce' : 'jump', x: this.x + 11, y: this.y + 30 });
  }
  step(dt, input, level) {
    const events = [], P = PHYSICS;
    if (this.dead) return events;
    this.invulnerable = Math.max(0, this.invulnerable - dt); this.stun = Math.max(0, this.stun - dt);
    this.cooldown = Math.max(0, this.cooldown - dt); this.buffer = Math.max(0, this.buffer - dt);
    this.squash = approach(this.squash, 0, dt * 2.6);
    if (this.grounded) this.coyote = P.coyote; else this.coyote = Math.max(0, this.coyote - dt);
    if (input.jumpPressed) this.buffer = P.buffer;
    if (this.standing?.active) { this.x += this.standing.dx; this.y += this.standing.dy; }
    const priorBottom = this.y + this.h;
    if (input.axis && !this.stun) this.facing = Math.sign(input.axis);
    if (input.dashPressed && this.cooldown <= 0 && !this.stun) {
      this.dash = P.dashTime; this.cooldown = P.dashCooldown; this.vy = 0; this.vx = this.facing * P.dashSpeed;
      events.push({ type: 'dash', x: this.x + 11, y: this.y + 16 });
    }
    if (this.buffer > 0 && this.coyote > 0 && !this.dash && !this.stun) this.jump(events);
    if (!input.jumpHeld && this.vy < -185 && !this.jumpCut && !this.dash) { this.vy *= .48; this.jumpCut = true; }
    if (this.dash > 0) {
      this.dash = Math.max(0, this.dash - dt); this.vx = this.facing * P.dashSpeed; this.vy = 0;
      if (!this.dash) this.vx = this.facing * P.speed;
    } else {
      if (!this.stun) {
        const acceleration = input.axis ? (this.grounded ? P.acceleration : P.airAcceleration) : (this.grounded ? P.friction : P.airFriction);
        this.vx = approach(this.vx, input.axis * P.speed, acceleration * dt);
      }
      this.vy = Math.min(P.terminal, this.vy + (this.vy < 0 ? P.gravity : P.fallGravity) * dt);
    }
    const previousX = this.x;
    this.x += this.vx * dt; this.x = clamp(this.x, 0, level.width - this.w);
    for (const p of level.platforms) {
      if (!p.active || !p.solid || !overlap(this, p)) continue;
      if (previousX + this.w <= p.x + 1) this.x = p.x - this.w;
      else if (previousX >= p.x + p.w - 1) this.x = p.x + p.w;
      else continue;
      this.vx = 0; this.dash = 0;
    }
    const wasGrounded = this.grounded, previousY = this.y, fallingSpeed = this.vy;
    this.y += this.vy * dt; this.grounded = false; this.standing = null;
    let top = Infinity, landing = null;
    for (const p of level.platforms) {
      if (!p.active || this.x + this.w <= p.x || this.x >= p.x + p.w) continue;
      const bottom = this.y + this.h;
      if (this.vy >= 0 && priorBottom <= p.y + Math.max(1, p.dy) + .1 && bottom >= p.y && p.y < top) { top = p.y; landing = p; }
      if (p.solid && this.vy < 0 && previousY >= p.y + p.h && this.y < p.y + p.h) { this.y = p.y + p.h; this.vy = 0; }
    }
    if (landing) {
      this.y = landing.y - this.h; this.vy = 0; this.grounded = true; this.standing = landing;
      if (!wasGrounded && fallingSpeed > 100) { this.squash = .24; events.push({ type: 'land', x: this.x + 11, y: this.y + 30, strength: fallingSpeed }); }
      if (landing.type === 'bounce') this.jump(events, 680);
      else if (this.buffer > 0 && !this.dash && !this.stun) this.jump(events);
    }
    if (Math.abs(this.vx) > 15) this.run += Math.abs(this.vx) * dt / 26;
    this.state = this.dash ? 'dash' : this.stun ? 'damage' : !this.grounded ? (this.vy < 0 ? 'jump' : 'fall') : Math.abs(this.vx) > 20 ? 'run' : 'idle';
    for (const bit of [...level.bits, ...level.cores]) {
      if (!bit.collected && Math.abs(this.x + 11 - bit.x) < 23 && Math.abs(this.y + 15 - bit.y) < 25) {
        bit.collected = true; events.push({ type: level.cores.includes(bit) ? 'core' : 'bit', x: bit.x, y: bit.y, id: bit.id });
      }
    }
    for (const e of level.enemies) {
      if (!e.alive || !overlap(this, e)) continue;
      if (this.dash || (e.type !== 'drone' && fallingSpeed > 35 && priorBottom < e.y + 13)) {
        e.alive = false; e.death = .32;
        if (!this.dash) { this.vy = input.jumpHeld ? -390 : -310; this.grounded = false; this.standing = null; this.jumpCut = !input.jumpHeld; }
        events.push({ type: 'stomp', x: e.x + e.w / 2, y: e.y + e.h / 2 });
      } else this.hurt(e.x + e.w / 2, events);
    }
    for (const h of level.hazards) {
      if (h.type === 'laser' && !h.active) continue;
      const hitbox = h.type === 'laser' ? { ...h, x: h.x + (h.offset || 0) } : { x: h.x + 4, y: h.y + 4, w: h.w - 8, h: h.h - 4 };
      if (overlap(this, hitbox)) this.hurt(hitbox.x + hitbox.w / 2, events);
    }
    for (const c of level.checkpoints) {
      if (!c.active && Math.abs(this.x + 11 - c.x) < 34 && Math.abs(this.y + 30 - c.y) < 45) { c.active = true; this.health = 3; events.push({ type: 'checkpoint', x: c.x, y: c.y, checkpoint: { x: c.x - 10, y: c.y - 30 } }); }
    }
    for (const s of level.secrets) {
      if (!s.revealed && overlap(this, s)) { s.revealed = true; events.push({ type: 'secret', text: s.label }); }
    }
    if (this.y > 675 || this.health <= 0) { this.dead = true; events.push({ type: 'death', x: this.x + 11, y: Math.min(620, this.y + 15) }); }
    if (!this.dead && Math.abs(this.x + 11 - level.tower.x) < 43 && Math.abs(this.y + 30 - (level.tower.y + 30)) < 90) events.push({ type: 'complete' });
    return events;
  }
  hurt(sourceX, events) {
    if (this.invulnerable || this.dead) return;
    this.health--; this.invulnerable = 1.45; this.stun = .22; this.dash = 0;
    this.vx = this.x + 11 < sourceX ? -245 : 245; this.vy = -245; this.grounded = false; this.standing = null;
    events.push({ type: 'hurt', x: this.x + 11, y: this.y + 15 });
  }
}

export class Camera {
  constructor() { this.x = 0; this.y = 0; this.shake = 0; }
  reset(player, level) { this.x = clamp(player.x - 320, 0, level.width - 960); this.y = clamp(player.y - 340, -85, 85); this.shake = 0; }
  update(dt, player, level, reduced) {
    const targetX = clamp(player.x - 385 + (reduced ? 30 : player.vx * .24), 0, level.width - 960);
    const targetY = clamp(player.y - 340, -85, 85);
    this.x += (targetX - this.x) * (1 - Math.exp(-dt * 5)); this.y += (targetY - this.y) * (1 - Math.exp(-dt * 3));
    this.shake = Math.max(0, this.shake - dt * 15);
  }
}
