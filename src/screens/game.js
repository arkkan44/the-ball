const RADIUS_METERS = 200
const THROW_TIME_LIMIT = 3000

function degToRad(d) { return d * Math.PI / 180 }

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = degToRad(lat2 - lat1)
  const dLng = degToRad(lng2 - lng1)
  const a = Math.sin(dLat/2)**2 + Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function bearingDeg(lat1, lng1, lat2, lng2) {
  const dLng = degToRad(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(degToRad(lat2))
  const x = Math.cos(degToRad(lat1)) * Math.sin(degToRad(lat2)) - Math.sin(degToRad(lat1)) * Math.cos(degToRad(lat2)) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

function getEdgePosition(bearing) {
  const W = window.innerWidth, H = window.innerHeight
  const cx = W / 2, cy = H / 2
  const angle = (bearing - 90) * Math.PI / 180
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const margin = 52
  const t = Math.min((W/2 - margin) / Math.abs(cos || 0.001), (H/2 - margin) / Math.abs(sin || 0.001))
  return { x: cx + cos * t, y: cy + sin * t }
}

function getFakePlayers(myLat, myLng) {
  const o = 0.0005
  return [
    { id: 'sim-1', pseudo: 'Marco',  latitude: myLat + o,       longitude: myLng + o * 0.5,  sim: true },
    { id: 'sim-2', pseudo: 'Sofia',  latitude: myLat - o * 0.8, longitude: myLng + o,        sim: true },
    { id: 'sim-3', pseudo: 'Karim',  latitude: myLat + o * 0.3, longitude: myLng - o,        sim: true },
    { id: 'sim-4', pseudo: 'Jade',   latitude: myLat - o,       longitude: myLng - o * 0.6,  sim: true },
    { id: 'sim-5', pseudo: 'Théo',   latitude: myLat + o * 1.2, longitude: myLng + o * 0.2,  sim: true },
  ]
}

export function renderGame() {
  return `
<style>
  *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; }

  #game {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    overflow: hidden;
    touch-action: none;
    font-family: system-ui, sans-serif;
  }

  /* ── TERRAIN ── */
  #field-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  /* ── HUD ── */
  #hud {
    position: absolute;
    top: env(safe-area-inset-top, 0px);
    left: 0; right: 0;
    display: flex;
    justify-content: center;
    gap: 10px;
    z-index: 40;
    padding-top: 14px;
  }
  .badge {
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 0.5px solid rgba(255,255,255,0.13);
    border-radius: 20px;
    padding: 6px 14px;
    font-size: 13px;
    color: rgba(255,255,255,0.85);
  }
  #timer-badge { color: #ff4444; font-weight: 700; display: none; font-size: 15px; }
  #sim-badge { background: rgba(79,195,247,0.18); border-color: rgba(79,195,247,0.35); color: #4fc3f7; display: none; }

  /* ── TIMER RING ── */
  #timer-ring {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 35;
    display: none;
    pointer-events: none;
  }

  /* ── BALLE ── */
  #ball {
    position: absolute;
    width: 56px; height: 56px;
    border-radius: 50%;
    display: none;
    z-index: 50;
    cursor: grab;
    font-size: 44px;
    line-height: 56px;
    text-align: center;
    user-select: none;
    filter: drop-shadow(0 0 12px rgba(255,255,255,0.35));
    transition: filter 0.15s;
  }
  #ball.held {
    cursor: grabbing;
    filter: drop-shadow(0 0 24px rgba(255,255,128,0.9));
  }

  /* ── JOUEURS ── */
  .player-dot-wrap {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    z-index: 45;
    transform: translate(-50%, -50%);
    cursor: pointer;
  }
  .player-dot {
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #4fc3f7;
    border: 2px solid rgba(255,255,255,0.6);
    box-shadow: 0 0 10px rgba(79,195,247,0.6);
    animation: pBreath 2.5s ease-in-out infinite;
  }
  .player-dot.sim { background: #ff9f4a; box-shadow: 0 0 10px rgba(255,159,74,0.6); }
  .player-label {
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(4px);
    border-radius: 12px;
    padding: 3px 10px;
    font-size: 12px;
    color: rgba(255,255,255,0.92);
    white-space: nowrap;
    border: 0.5px solid rgba(255,255,255,0.12);
  }
  @keyframes pBreath { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.3);opacity:1} }

  /* ── TRAIL ── */
  .trail {
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,200,0.7), transparent);
    pointer-events: none;
    z-index: 48;
  }

  /* ── STATUS ── */
  #status-bar {
    position: absolute;
    bottom: env(safe-area-inset-bottom, 0px);
    left: 0; right: 0;
    text-align: center;
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    z-index: 40;
    padding: 20px 20px 28px;
    background: linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 100%);
  }

  /* ── HINT ── */
  .throw-hint {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, calc(-50% + 52px));
    color: rgba(255,255,255,0.22);
    font-size: 11px;
    z-index: 36;
    pointer-events: none;
    text-align: center;
    display: none;
    letter-spacing: 1.5px;
  }
</style>

<div id="game">
  <canvas id="field-canvas"></canvas>

  <div id="hud">
    <div class="badge" id="pseudo-badge">—</div>
    <div class="badge" id="players-badge">0 joueur</div>
    <div class="badge" id="timer-badge">3s</div>
    <div class="badge" id="sim-badge">🤖 SIMULATION</div>
  </div>

  <svg id="timer-ring" width="110" height="110" viewBox="0 0 110 110">
    <circle cx="55" cy="55" r="48" fill="none" stroke="rgba(255,68,68,0.12)" stroke-width="5"/>
    <circle id="timer-arc" cx="55" cy="55" r="48" fill="none" stroke="#ff4444" stroke-width="5"
      stroke-linecap="round" stroke-dasharray="301.6" stroke-dashoffset="0"
      transform="rotate(-90 55 55)"/>
  </svg>

  <div id="ball">⚽</div>
  <div class="throw-hint" id="throw-hint">GLISSE VERS UN JOUEUR</div>
  <div id="status-bar">En attente...</div>
</div>
  `
}

/* ══════════════════════════════════════════════
   DESSIN DU TERRAIN SUR CANVAS
══════════════════════════════════════════════ */
function drawField(canvas) {
  const W = canvas.width = window.innerWidth
  const H = canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')

  // Fond dégradé vert très sombre
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0,   '#081508')
  bg.addColorStop(0.5, '#0b1d0b')
  bg.addColorStop(1,   '#081508')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Bandes de gazon alternées (très subtiles)
  const stripeW = W / 10
  ctx.save()
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.0)'
    ctx.fillRect(i * stripeW, 0, stripeW, H)
  }
  ctx.restore()

  const lc = 'rgba(255,255,255,0.18)'  // couleur des lignes
  const lw = 1.8

  ctx.strokeStyle = lc
  ctx.lineWidth = lw
  ctx.lineCap = 'round'

  const pad = 22
  const fw = W - pad * 2
  const fh = H - pad * 2
  const fx = pad, fy = pad

  function line(x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }
  function rect(x, y, w, h) {
    ctx.strokeRect(x, y, w, h)
  }
  function arc(cx, cy, r, a1, a2) {
    ctx.beginPath(); ctx.arc(cx, cy, r, a1, a2); ctx.stroke()
  }
  function dot(cx, cy, r) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2)
    ctx.fillStyle = lc; ctx.fill()
  }

  // Cadre extérieur
  rect(fx, fy, fw, fh)

  // Ligne médiane
  line(fx, fy + fh/2, fx + fw, fy + fh/2)

  // Rond central
  const cx = fx + fw/2, cy = fy + fh/2
  arc(cx, cy, Math.min(fw, fh) * 0.13, 0, Math.PI * 2)
  dot(cx, cy, 3)

  // Surface de réparation haut
  const bw = fw * 0.55, bh = fh * 0.18
  const bx = fx + (fw - bw) / 2
  rect(bx, fy, bw, bh)

  // Petite surface haut
  const sw = fw * 0.28, sh = fh * 0.09
  const sx = fx + (fw - sw) / 2
  rect(sx, fy, sw, sh)

  // Surface de réparation bas
  rect(bx, fy + fh - bh, bw, bh)
  rect(sx, fy + fh - sh, sw, sh)

  // Arc de cercle surfaces (haut et bas)
  ctx.save()
  ctx.beginPath()
  ctx.rect(bx, fy + bh, bw, fh * 0.12)
  ctx.clip()
  arc(cx, fy + bh, Math.min(fw, fh) * 0.11, 0, Math.PI)
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.rect(bx, fy + fh - bh - fh*0.12, bw, fh * 0.12)
  ctx.clip()
  arc(cx, fy + fh - bh, Math.min(fw, fh) * 0.11, Math.PI, Math.PI*2)
  ctx.restore()

  // Points de penalty
  dot(cx, fy + fh * 0.13, 3)
  dot(cx, fy + fh * 0.87, 3)

  // Corners (arcs)
  const cr = 12
  ctx.beginPath(); ctx.arc(fx, fy, cr, 0, Math.PI/2); ctx.stroke()
  ctx.beginPath(); ctx.arc(fx+fw, fy, cr, Math.PI/2, Math.PI); ctx.stroke()
  ctx.beginPath(); ctx.arc(fx, fy+fh, cr, -Math.PI/2, 0); ctx.stroke()
  ctx.beginPath(); ctx.arc(fx+fw, fy+fh, cr, Math.PI, -Math.PI/2); ctx.stroke()

  // Buts (haut et bas)
  const gw = fw * 0.22, gh = fh * 0.025
  const gx = fx + (fw - gw) / 2
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 2.5
  rect(gx, fy - gh, gw, gh)
  rect(gx, fy + fh, gw, gh)

  ctx.strokeStyle = lc
  ctx.lineWidth = lw
}

/* ══════════════════════════════════════════════
   PHYSIQUE DE LA BALLE
══════════════════════════════════════════════ */
class BallPhysics {
  constructor(ballEl, onStop, onBounce) {
    this.el = ballEl
    this.onStop = onStop
    this.onBounce = onBounce
    this.x = 0; this.y = 0
    this.vx = 0; this.vy = 0
    this.R = 28
    this.friction = 0.975
    this.running = false
    this.raf = null
    this.bounceCount = 0
    this.maxBounces = 3
    this.stopped = false
  }

  launch(startX, startY, targetX, targetY, speed = 18) {
    this.x = startX; this.y = startY
    const dx = targetX - startX, dy = targetY - startY
    const len = Math.sqrt(dx*dx + dy*dy) || 1
    this.vx = (dx / len) * speed
    this.vy = (dy / len) * speed
    this.bounceCount = 0
    this.stopped = false
    this.running = true
    this.el.style.display = 'block'
    this._update()
  }

  _update() {
    if (!this.running) return
    const W = window.innerWidth, H = window.innerHeight
    this.x += this.vx
    this.y += this.vy
    this.vx *= this.friction
    this.vy *= this.friction

    let bounced = false

    // Rebonds sur les bords (sauf bas qui est le "sol" après maxBounces)
    if (this.x - this.R < 0) {
      this.x = this.R; this.vx = Math.abs(this.vx); bounced = true
    } else if (this.x + this.R > W) {
      this.x = W - this.R; this.vx = -Math.abs(this.vx); bounced = true
    }
    if (this.y - this.R < 0) {
      this.y = this.R; this.vy = Math.abs(this.vy); bounced = true
    } else if (this.y + this.R > H) {
      this.y = H - this.R; this.vy = -Math.abs(this.vy); bounced = true
    }

    if (bounced) {
      this.bounceCount++
      if (this.onBounce) this.onBounce(this.bounceCount)
    }

    // Mise à jour position balle
    this.el.style.left = (this.x - 28) + 'px'
    this.el.style.top  = (this.y - 28) + 'px'

    // Vitesse trop faible ou trop de rebonds → stop
    const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy)
    if (speed < 0.4 || (this.bounceCount >= this.maxBounces && speed < 2.5)) {
      this.running = false
      this.stopped = true
      if (this.onStop) this.onStop(this.x, this.y)
      return
    }

    this.raf = requestAnimationFrame(() => this._update())
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  setPos(x, y) {
    this.x = x; this.y = y
    this.el.style.left = (x - 28) + 'px'
    this.el.style.top  = (y - 28) + 'px'
  }
}

/* ══════════════════════════════════════════════
   INIT JEU
══════════════════════════════════════════════ */
export function initGame(sb, myUser, myPseudo, simulationMode = false) {
  const myId = myUser?.id || ('guest-' + Math.random().toString(36).substr(2, 6))
  let myLat = null, myLng = null
  let players = {}
  let hasBall = false, ballHeld = false
  let throwTimer = null, throwStart = null

  const game       = document.getElementById('game')
  const canvas     = document.getElementById('field-canvas')
  const ballEl     = document.getElementById('ball')
  const pseudoBadge  = document.getElementById('pseudo-badge')
  const playersBadge = document.getElementById('players-badge')
  const timerBadge   = document.getElementById('timer-badge')
  const timerRing    = document.getElementById('timer-ring')
  const timerArc     = document.getElementById('timer-arc')
  const statusEl     = document.getElementById('status-bar')
  const simBadge     = document.getElementById('sim-badge')
  const throwHint    = document.getElementById('throw-hint')

  // Dessin terrain
  drawField(canvas)
  window.addEventListener('resize', () => drawField(canvas))

  pseudoBadge.textContent = myPseudo
  if (simulationMode) simBadge.style.display = 'block'

  // Physique
  const physics = new BallPhysics(ballEl,
    (fx, fy) => {
      // Balle arrêtée → joueur peut l'attraper
      throwHint.style.display = 'block'
      setStatus('⚽ Attrape la balle !')
    },
    (count) => {
      // Flash au rebond
      ballEl.style.filter = 'drop-shadow(0 0 20px rgba(255,255,128,0.9))'
      setTimeout(() => { ballEl.style.filter = '' }, 120)
    }
  )

  function setStatus(msg) { statusEl.textContent = msg }

  function renderPlayers() {
    document.querySelectorAll('.player-dot-wrap').forEach(e => e.remove())
    if (!myLat) return
    let count = 0
    Object.values(players).forEach(p => {
      if (p.id === myId || !p.latitude) return
      const dist = distanceMeters(myLat, myLng, p.latitude, p.longitude)
      if (dist > RADIUS_METERS) return
      count++
      const bearing = bearingDeg(myLat, myLng, p.latitude, p.longitude)
      const pos = getEdgePosition(bearing)
      const el = document.createElement('div')
      el.className = 'player-dot-wrap'
      el.style.left = pos.x + 'px'
      el.style.top  = pos.y + 'px'
      el.dataset.pid = p.id
      el.innerHTML = `<div class="player-dot${p.sim?' sim':''}"></div><div class="player-label">${p.pseudo}</div>`
      el.addEventListener('pointerup', () => { if (hasBall && physics.stopped) throwBallTo(p) })
      game.appendChild(el)
    })
    playersBadge.textContent = count === 0 ? '0 joueur' : count === 1 ? '1 joueur' : count + ' joueurs'
  }

  function hideBall() {
    ballEl.style.display = 'none'
    physics.stop()
    hasBall = false
    ballHeld = false
    throwHint.style.display = 'none'
    clearThrowTimer()
  }

  /* Lance la balle depuis la position du joueur expéditeur */
  function receiveBall(fromId) {
    hasBall = true
    const from = players[fromId]
    let startX, startY

    if (from && myLat) {
      const bearing = bearingDeg(myLat, myLng, from.latitude, from.longitude)
      const edge = getEdgePosition(bearing)
      startX = edge.x; startY = edge.y
    } else {
      startX = Math.random() * window.innerWidth
      startY = 0
    }

    const cx = window.innerWidth / 2, cy = window.innerHeight / 2
    ballEl.style.display = 'block'
    physics.launch(startX, startY, cx, cy, 16)
    setStatus(from ? `⚽ Balle de ${from.pseudo} — attrape-la !` : '⚽ Tu as la balle !')
    startThrowTimer()
  }

  function startThrowTimer() {
    clearThrowTimer()
    throwStart = Date.now()
    timerBadge.style.display = 'block'
    timerBadge.style.color = '#ff4444'
    timerRing.style.display = 'block'
    const circ = 301.6
    throwTimer = setInterval(() => {
      const elapsed = Date.now() - throwStart
      const pct = Math.max(0, 1 - elapsed / THROW_TIME_LIMIT)
      timerBadge.textContent = Math.max(0, Math.ceil((THROW_TIME_LIMIT - elapsed) / 1000)) + 's'
      timerArc.style.strokeDashoffset = String(circ * (1 - pct))
      if (pct < 0.33) { timerBadge.style.color = '#ff2222'; timerArc.style.stroke = '#ff2222' }
      if (elapsed >= THROW_TIME_LIMIT) { clearThrowTimer(); disqualify() }
    }, 50)
  }

  function clearThrowTimer() {
    clearInterval(throwTimer); throwTimer = null
    timerBadge.style.display = 'none'
    timerRing.style.display  = 'none'
    timerArc.style.strokeDashoffset = '0'
    timerArc.style.stroke = '#ff4444'
  }

  function disqualify() {
    hideBall()
    setStatus('⚠ Trop lent — balle perdue !')
    if (!simulationMode) updateBallState({ status: 'idle', holder_id: null, from_id: null, target_id: null })
  }

  async function throwBallTo(targetPlayer) {
    if (!hasBall || !physics.stopped) return
    clearThrowTimer()
    throwHint.style.display = 'none'

    // Lancer depuis centre vers le bord côté target
    const bearing = bearingDeg(myLat, myLng, targetPlayer.latitude, targetPlayer.longitude)
    const endPos  = getEdgePosition(bearing)
    const bx = physics.x, by = physics.y

    // Petite animation de lancer
    const dx = endPos.x - bx, dy = endPos.y - by
    const dist = Math.sqrt(dx*dx + dy*dy)
    physics.friction = 1.0   // lancer sans friction
    physics.maxBounces = 999  // ne rebondit pas avant de partir
    physics.vx = dx / dist * 22
    physics.vy = dy / dist * 22
    physics.running = true
    physics.stopped = false
    physics._update()

    setTimeout(async () => {
      hideBall()
      physics.friction = 0.975
      physics.maxBounces = 3
      setStatus(`✅ Envoyée à ${targetPlayer.pseudo} !`)
      if (simulationMode) {
        setTimeout(() => { receiveBall(targetPlayer.id) }, 1800)
      } else {
        await updateBallState({ status: 'flying', holder_id: targetPlayer.id, from_id: myId, target_id: targetPlayer.id, updated_at: new Date().toISOString() })
      }
    }, 500)
  }

  // ── Drag de la balle ──
  let dragOffX = 0, dragOffY = 0

  ballEl.addEventListener('pointerdown', e => {
    if (!hasBall || !physics.stopped) return
    physics.stop()
    ballHeld = true
    ballEl.setPointerCapture(e.pointerId)
    ballEl.classList.add('held')
    throwHint.style.display = 'none'
    dragOffX = e.clientX - physics.x
    dragOffY = e.clientY - physics.y
    e.preventDefault()
  })

  ballEl.addEventListener('pointermove', e => {
    if (!ballHeld) return
    const nx = e.clientX - dragOffX
    const ny = e.clientY - dragOffY
    physics.setPos(nx, ny)
    e.preventDefault()
  })

  ballEl.addEventListener('pointerup', e => {
    if (!ballHeld) return
    ballHeld = false
    ballEl.classList.remove('held')
    const x = physics.x, y = physics.y
    const W = window.innerWidth, H = window.innerHeight
    const margin = 72

    if (x < margin || x > W - margin || y < margin || y > H - margin) {
      const dx = x - W/2, dy = y - H/2
      const bearing = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360
      const target = findNearestInDirection(bearing)
      if (target) {
        physics.stopped = true
        throwBallTo(target)
      } else {
        setStatus('Aucun joueur dans cette direction !')
        physics.stopped = true
        throwHint.style.display = 'block'
      }
    } else {
      // Repositionner au centre si pas lancé
      physics.stopped = true
      throwHint.style.display = 'block'
      setStatus('⚽ Lance la balle vers un joueur !')
    }
  })

  function findNearestInDirection(bearing) {
    let best = null, bestDiff = 55
    Object.values(players).forEach(p => {
      if (p.id === myId || !p.latitude) return
      const dist = distanceMeters(myLat, myLng, p.latitude, p.longitude)
      if (dist > RADIUS_METERS) return
      const pb = bearingDeg(myLat, myLng, p.latitude, p.longitude)
      let diff = Math.abs(pb - bearing); if (diff > 180) diff = 360 - diff
      if (diff < bestDiff) { bestDiff = diff; best = p }
    })
    return best
  }

  async function updateBallState(data) {
    if (!sb) return
    await sb.from('ball_state').update({ ...data, updated_at: new Date().toISOString() }).eq('id', 'current')
  }

  async function updatePosition() {
    if (!myId || myLat === null || simulationMode || !sb) return
    await sb.from('ball_players').upsert({ id: myId, pseudo: myPseudo, latitude: myLat, longitude: myLng, last_seen: new Date().toISOString(), user_id: myUser?.id || null })
  }

  function subscribeRealtime() {
    if (!sb || simulationMode) return
    sb.channel('ball-game-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_players' }, payload => {
        if (payload.new?.id) { players[payload.new.id] = payload.new; renderPlayers() }
        if (payload.eventType === 'DELETE' && payload.old?.id) { delete players[payload.old.id]; renderPlayers() }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ball_state' }, payload => {
        const state = payload.new
        if (!state) return
        if (state.status === 'flying' && state.holder_id === myId && state.from_id !== myId) receiveBall(state.from_id)
        if (state.status === 'idle' && hasBall) { hideBall(); setStatus('En attente de la balle...') }
      })
      .subscribe()
  }

  const getPos = () => new Promise(resolve => {
    if (!navigator.geolocation) { resolve({ lat: 43.2965, lng: 5.3698 }); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({ lat: 43.2965 + (Math.random()-.5)*.0003, lng: 5.3698 + (Math.random()-.5)*.0003 }),
      { timeout: 6000, enableHighAccuracy: true }
    )
  })

  async function start() {
    const pos = await getPos()
    myLat = pos.lat; myLng = pos.lng

    if (simulationMode) {
      const fakes = getFakePlayers(myLat, myLng)
      fakes.forEach(p => { players[p.id] = p })
      renderPlayers()
      setTimeout(() => {
        // Simule réception depuis Marco (nord-est)
        const marco = players['sim-1']
        receiveBall(marco.id)
        setStatus('⚽ Balle de Marco — attrape-la !')
      }, 700)
      return
    }

    await updatePosition()
    subscribeRealtime()
    setInterval(() => updatePosition(), 5000)

    const { data: state } = await sb.from('ball_state').select('*').eq('id', 'current').single()
    if (state && (state.status === 'idle' || !state.holder_id)) {
      setTimeout(() => {
        receiveBall('system')
        setStatus('⚽ Tu as la balle !')
      }, 500)
      await updateBallState({ status: 'flying', holder_id: myId, from_id: 'system', target_id: myId })
    } else {
      setStatus('En attente de la balle...')
    }
  }

  start()

  window.addEventListener('beforeunload', () => {
    if (myId && !simulationMode && sb) sb.from('ball_players').delete().eq('id', myId)
  })
}
