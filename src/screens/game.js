const RADIUS_METERS = 200
const THROW_TIME_LIMIT = 3000
const TARGET_CATCH_RADIUS = 50  // px — si lancer hors de ce cercle → rebond

function degToRad(d) { return d * Math.PI / 180 }

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = degToRad(lat2 - lat1), dLng = degToRad(lng2 - lng1)
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

/* ══ TERRAIN CANVAS ══ */
function drawField(canvas) {
  const W = canvas.width = window.innerWidth
  const H = canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#081508'); bg.addColorStop(0.5, '#0b1d0b'); bg.addColorStop(1, '#081508')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  const sw = W / 10
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0)'
    ctx.fillRect(i * sw, 0, sw, H)
  }
  const lc = 'rgba(255,255,255,0.2)', lw = 1.8
  ctx.strokeStyle = lc; ctx.lineWidth = lw; ctx.lineCap = 'round'
  const pad = 22, fw = W - pad*2, fh = H - pad*2, fx = pad, fy = pad
  const stroke = (fn) => { ctx.beginPath(); fn(); ctx.stroke() }
  ctx.strokeRect(fx, fy, fw, fh)
  stroke(() => { ctx.moveTo(fx, fy+fh/2); ctx.lineTo(fx+fw, fy+fh/2) })
  const cx = fx+fw/2, cy = fy+fh/2
  stroke(() => ctx.arc(cx, cy, Math.min(fw,fh)*0.13, 0, Math.PI*2))
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fillStyle = lc; ctx.fill()
  const bw=fw*0.55, bh=fh*0.18, bx=fx+(fw-bw)/2
  ctx.strokeRect(bx, fy, bw, bh); ctx.strokeRect(bx, fy+fh-bh, bw, bh)
  const sw2=fw*0.28, sh=fh*0.09, sx=fx+(fw-sw2)/2
  ctx.strokeRect(sx, fy, sw2, sh); ctx.strokeRect(sx, fy+fh-sh, sw2, sh)
  ;[[cx,fy+bh,1],[cx,fy+fh-bh,0]].forEach(([acx,acy,flip]) => {
    ctx.save(); ctx.beginPath(); ctx.rect(bx, flip?fy+fh-bh-fh*0.12:fy+bh, bw, fh*0.12); ctx.clip()
    stroke(() => ctx.arc(acx, acy, Math.min(fw,fh)*0.11, flip?Math.PI:0, flip?Math.PI*2:Math.PI))
    ctx.restore()
  })
  ;[[cx,fy+fh*0.13],[cx,fy+fh*0.87]].forEach(([px,py]) => {
    ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI*2); ctx.fillStyle = lc; ctx.fill()
  })
  const cr = 12
  ;[[fx,fy,0,Math.PI/2],[fx+fw,fy,Math.PI/2,Math.PI],[fx,fy+fh,-Math.PI/2,0],[fx+fw,fy+fh,Math.PI,-Math.PI/2]].forEach(([x,y,a1,a2]) => {
    stroke(() => ctx.arc(x, y, cr, a1, a2))
  })
  const gw=fw*0.22, gh=fh*0.025, gx=fx+(fw-gw)/2
  ctx.strokeStyle='rgba(255,255,255,0.28)'; ctx.lineWidth=2.5
  ctx.strokeRect(gx, fy-gh, gw, gh); ctx.strokeRect(gx, fy+fh, gw, gh)
}

/* ══ PHYSIQUE BALLE ══ */
class BallPhysics {
  constructor(ballEl, onStop, onBounce) {
    this.el = ballEl
    this.onStop = onStop
    this.onBounce = onBounce
    this.x = 0; this.y = 0
    this.vx = 0; this.vy = 0
    this.R = 28
    this.friction = 0.973
    this.running = false
    this.stopped = true
    this.raf = null
    this.bounceCount = 0
    this.maxBounces = 3
    this.freeThrow = false  // mode lancer libre sans limite de rebonds
  }

  launch(sx, sy, tx, ty, speed = 17) {
    this.x = sx; this.y = sy
    const dx = tx - sx, dy = ty - sy
    const len = Math.sqrt(dx*dx + dy*dy) || 1
    this.vx = dx/len * speed; this.vy = dy/len * speed
    this.bounceCount = 0
    this.stopped = false
    this.running = true
    this.freeThrow = false
    this.friction = 0.973
    this.maxBounces = 3
    this.el.style.display = 'block'
    cancelAnimationFrame(this.raf)
    this._tick()
  }

  throwFree(sx, sy, vx, vy) {
    this.x = sx; this.y = sy
    this.vx = vx; this.vy = vy
    this.bounceCount = 0
    this.stopped = false
    this.running = true
    this.freeThrow = true
    this.friction = 1.0   // vitesse constante pour sortir de l'écran
    this.el.style.display = 'block'
    cancelAnimationFrame(this.raf)
    this._tick()
  }

  _tick() {
    if (!this.running) return
    const W = window.innerWidth, H = window.innerHeight
    this.x += this.vx; this.y += this.vy
    this.vx *= this.friction; this.vy *= this.friction

    let bounced = false
    if (!this.freeThrow) {
      if (this.x - this.R < 0)   { this.x = this.R;   this.vx =  Math.abs(this.vx); bounced = true }
      else if (this.x + this.R > W) { this.x = W-this.R; this.vx = -Math.abs(this.vx); bounced = true }
      if (this.y - this.R < 0)   { this.y = this.R;   this.vy =  Math.abs(this.vy); bounced = true }
      else if (this.y + this.R > H) { this.y = H-this.R; this.vy = -Math.abs(this.vy); bounced = true }
      if (bounced) { this.bounceCount++; if (this.onBounce) this.onBounce(this.bounceCount) }
    } else {
      // Mode lancer libre : dès que la balle sort → stop
      if (this.x < -60 || this.x > W+60 || this.y < -60 || this.y > H+60) {
        this.running = false; this.stopped = true; return
      }
    }

    this.el.style.left = (this.x-28)+'px'; this.el.style.top = (this.y-28)+'px'

    const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy)
    if (!this.freeThrow && (speed < 0.5 || (this.bounceCount >= this.maxBounces && speed < 2.5))) {
      this.running = false; this.stopped = true
      if (this.onStop) this.onStop(this.x, this.y)
      return
    }
    this.raf = requestAnimationFrame(() => this._tick())
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); this.stopped = true }

  setPos(x, y) {
    this.x = x; this.y = y
    this.el.style.left = (x-28)+'px'; this.el.style.top = (y-28)+'px'
  }
}

/* ══ RENDU HTML ══ */
export function renderGame() {
  return `
<style>
  *, *::before, *::after { box-sizing:border-box; -webkit-tap-highlight-color:transparent; margin:0; padding:0; }
  html, body { width:100%; height:100%; overflow:hidden; }
  #game { position:fixed; inset:0; width:100vw; height:100dvh; overflow:hidden; touch-action:none; font-family:system-ui,sans-serif; }
  #field-canvas { position:absolute; inset:0; width:100%; height:100%; z-index:0; }

  /* HUD */
  #hud { position:absolute; top:env(safe-area-inset-top,0px); left:0; right:0; display:flex; justify-content:center; gap:10px; z-index:40; padding-top:14px; }
  .badge { background:rgba(0,0,0,0.65); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); border:0.5px solid rgba(255,255,255,0.13); border-radius:20px; padding:6px 14px; font-size:13px; color:rgba(255,255,255,0.85); }
  #sim-badge { background:rgba(79,195,247,0.18); border-color:rgba(79,195,247,0.35); color:#4fc3f7; display:none; }

  /* TIMER VISUEL — grand cercle central */
  #timer-wrap {
    position:absolute; top:50%; left:50%;
    transform:translate(-50%, -50%);
    z-index:36; display:none; pointer-events:none;
  }
  #timer-svg { display:block; }
  #timer-number {
    position:absolute; inset:0;
    display:flex; align-items:center; justify-content:center;
    font-size:52px; font-weight:800;
    color:#fff;
    text-shadow: 0 0 20px rgba(255,80,80,0.9), 0 0 40px rgba(255,80,80,0.5);
    font-variant-numeric: tabular-nums;
  }

  /* DISQUALIF */
  #disqualif {
    position:absolute; inset:0;
    display:none;
    flex-direction:column; align-items:center; justify-content:center;
    z-index:100;
    background:rgba(0,0,0,0.75);
    backdrop-filter:blur(6px);
  }
  #disqualif .dq-emoji { font-size:72px; animation:dqBounce 0.5s ease-out; }
  #disqualif .dq-title {
    font-size:42px; font-weight:900; letter-spacing:3px;
    color:#ff3333;
    text-shadow: 0 0 30px rgba(255,50,50,0.9), 0 0 60px rgba(255,50,50,0.5);
    animation:dqShake 0.4s ease-out 0.1s;
    margin:12px 0 8px;
  }
  #disqualif .dq-sub { font-size:18px; color:rgba(255,255,255,0.6); letter-spacing:2px; }
  #disqualif .dq-btn {
    margin-top:32px; background:rgba(255,255,255,0.1);
    border:1px solid rgba(255,255,255,0.25); border-radius:30px;
    padding:12px 32px; color:rgba(255,255,255,0.8);
    font-size:15px; cursor:pointer; letter-spacing:1px;
  }
  @keyframes dqBounce { 0%{transform:scale(0) rotate(-20deg)} 70%{transform:scale(1.2) rotate(5deg)} 100%{transform:scale(1) rotate(0)} }
  @keyframes dqShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-10px)} 75%{transform:translateX(10px)} }

  /* BALLE */
  #ball {
    position:absolute; width:56px; height:56px; border-radius:50%;
    display:none; z-index:50; cursor:grab; font-size:44px;
    line-height:56px; text-align:center; user-select:none;
    filter:drop-shadow(0 0 12px rgba(255,255,255,0.35));
  }
  #ball.held { cursor:grabbing; filter:drop-shadow(0 0 28px rgba(255,255,128,1)); }

  /* JOUEURS */
  .player-dot-wrap { position:absolute; display:flex; flex-direction:column; align-items:center; gap:5px; z-index:45; transform:translate(-50%,-50%); cursor:pointer; }
  .player-dot { width:18px; height:18px; border-radius:50%; background:#4fc3f7; border:2px solid rgba(255,255,255,0.6); box-shadow:0 0 10px rgba(79,195,247,0.6); animation:pB 2.5s ease-in-out infinite; }
  .player-dot.sim { background:#ff9f4a; box-shadow:0 0 10px rgba(255,159,74,0.6); }
  .player-label { background:rgba(0,0,0,0.72); border-radius:12px; padding:3px 10px; font-size:12px; color:rgba(255,255,255,0.92); white-space:nowrap; border:0.5px solid rgba(255,255,255,0.12); }
  @keyframes pB { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.3);opacity:1} }

  /* CERCLE CIBLE autour des joueurs quand on a la balle */
  .target-ring { position:absolute; border-radius:50%; border:2px dashed rgba(127,255,127,0.5); pointer-events:none; z-index:44; transform:translate(-50%,-50%); animation:ringPulse 1.5s ease-in-out infinite; }
  @keyframes ringPulse { 0%,100%{opacity:0.4;transform:translate(-50%,-50%) scale(1)} 50%{opacity:0.9;transform:translate(-50%,-50%) scale(1.08)} }

  /* TRAIL */
  .trail { position:absolute; border-radius:50%; background:radial-gradient(circle,rgba(255,255,200,0.7),transparent); pointer-events:none; z-index:48; }

  /* STATUS */
  #status-bar { position:absolute; bottom:env(safe-area-inset-bottom,0px); left:0; right:0; text-align:center; font-size:14px; color:rgba(255,255,255,0.5); z-index:40; padding:20px 20px 28px; background:linear-gradient(to top,rgba(0,0,0,0.4),transparent); }

  .throw-hint { position:absolute; top:50%; left:50%; transform:translate(-50%,calc(-50% + 52px)); color:rgba(255,255,255,0.22); font-size:11px; z-index:36; pointer-events:none; text-align:center; display:none; letter-spacing:1.5px; }
</style>

<div id="game">
  <canvas id="field-canvas"></canvas>

  <div id="hud">
    <div class="badge" id="pseudo-badge">—</div>
    <div class="badge" id="players-badge">0 joueur</div>
    <div class="badge" id="sim-badge">🤖 SIMULATION</div>
  </div>

  <!-- Timer grand format centré -->
  <div id="timer-wrap">
    <svg id="timer-svg" width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="62" fill="rgba(0,0,0,0.5)" stroke="rgba(255,68,68,0.15)" stroke-width="6"/>
      <circle id="timer-arc" cx="70" cy="70" r="62" fill="none" stroke="#ff4444" stroke-width="6"
        stroke-linecap="round" stroke-dasharray="389.6" stroke-dashoffset="0"
        transform="rotate(-90 70 70)"/>
    </svg>
    <div id="timer-number">3</div>
  </div>

  <!-- Écran disqualification -->
  <div id="disqualif">
    <div class="dq-emoji">😵</div>
    <div class="dq-title">DISQUALIFIÉ !</div>
    <div class="dq-sub">T'AS PAS ÉTÉ ASSEZ RAPIDE</div>
    <button class="dq-btn" id="dq-retry">↩ REVENIR AU JEU</button>
  </div>

  <div id="ball">⚽</div>
  <div class="throw-hint" id="throw-hint">GLISSE VERS UN JOUEUR</div>
  <div id="status-bar">En attente...</div>
</div>
`
}

/* ══ INIT JEU ══ */
export function initGame(sb, myUser, myPseudo, simulationMode = false) {
  const myId = myUser?.id || ('guest-' + Math.random().toString(36).substr(2,6))
  let myLat = null, myLng = null
  let players = {}
  let hasBall = false, ballHeld = false
  let throwTimer = null, throwStart = null
  let playerPositionsOnScreen = {}  // cache positions px des joueurs

  const game         = document.getElementById('game')
  const canvas       = document.getElementById('field-canvas')
  const ballEl       = document.getElementById('ball')
  const pseudoBadge  = document.getElementById('pseudo-badge')
  const playersBadge = document.getElementById('players-badge')
  const timerWrap    = document.getElementById('timer-wrap')
  const timerArc     = document.getElementById('timer-arc')
  const timerNumber  = document.getElementById('timer-number')
  const statusEl     = document.getElementById('status-bar')
  const simBadge     = document.getElementById('sim-badge')
  const throwHint    = document.getElementById('throw-hint')
  const disqualifEl  = document.getElementById('disqualif')

  drawField(canvas)
  window.addEventListener('resize', () => drawField(canvas))

  pseudoBadge.textContent = myPseudo
  if (simulationMode) simBadge.style.display = 'block'

  const physics = new BallPhysics(ballEl,
    (fx, fy) => { throwHint.style.display = 'block'; setStatus('⚽ Attrape la balle et lance !') },
    () => { ballEl.style.filter = 'drop-shadow(0 0 22px rgba(255,255,128,1))'; setTimeout(()=>{ ballEl.style.filter='' },120) }
  )

  function setStatus(msg) { statusEl.textContent = msg }

  function renderPlayers() {
    document.querySelectorAll('.player-dot-wrap,.target-ring').forEach(e => e.remove())
    playerPositionsOnScreen = {}
    if (!myLat) return
    let count = 0
    Object.values(players).forEach(p => {
      if (p.id === myId || !p.latitude) return
      if (distanceMeters(myLat, myLng, p.latitude, p.longitude) > RADIUS_METERS) return
      count++
      const bearing = bearingDeg(myLat, myLng, p.latitude, p.longitude)
      const pos = getEdgePosition(bearing)
      playerPositionsOnScreen[p.id] = pos

      // Cercle cible si j'ai la balle
      if (hasBall) {
        const ring = document.createElement('div')
        ring.className = 'target-ring'
        ring.style.cssText = `left:${pos.x}px;top:${pos.y}px;width:${TARGET_CATCH_RADIUS*2}px;height:${TARGET_CATCH_RADIUS*2}px;`
        game.appendChild(ring)
      }

      const el = document.createElement('div')
      el.className = 'player-dot-wrap'
      el.style.left = pos.x+'px'; el.style.top = pos.y+'px'
      el.dataset.pid = p.id
      el.innerHTML = `<div class="player-dot${p.sim?' sim':''}"></div><div class="player-label">${p.pseudo}</div>`
      el.addEventListener('pointerup', () => { if (hasBall && physics.stopped) throwBallToPlayer(p) })
      game.appendChild(el)
    })
    playersBadge.textContent = count===0?'0 joueur':count===1?'1 joueur':count+' joueurs'
  }

  function hideBall() {
    ballEl.style.display = 'none'; physics.stop()
    hasBall = false; ballHeld = false
    throwHint.style.display = 'none'
    clearThrowTimer()
    renderPlayers()  // retire les cercles cibles
  }

  function receiveBall(fromId) {
    hasBall = true
    renderPlayers()  // affiche cercles cibles
    const from = players[fromId]
    let sx, sy
    if (from && myLat) {
      const edge = getEdgePosition(bearingDeg(myLat, myLng, from.latitude, from.longitude))
      sx = edge.x; sy = edge.y
    } else { sx = window.innerWidth/2; sy = 0 }

    ballEl.style.display = 'block'
    physics.launch(sx, sy, window.innerWidth/2, window.innerHeight/2, 16)
    setStatus(from ? `⚽ Balle de ${from.pseudo} — attrape !` : '⚽ La balle arrive !')
    startThrowTimer()
  }

  function startThrowTimer() {
    clearThrowTimer()
    throwStart = Date.now()
    timerWrap.style.display = 'block'
    const circ = 389.6
    throwTimer = setInterval(() => {
      const elapsed = Date.now() - throwStart
      const pct = Math.max(0, 1 - elapsed/THROW_TIME_LIMIT)
      const secs = Math.max(0, Math.ceil((THROW_TIME_LIMIT-elapsed)/1000))
      timerNumber.textContent = secs
      timerArc.style.strokeDashoffset = String(circ*(1-pct))
      if (pct < 0.5) { timerArc.style.stroke='#ff6600'; timerNumber.style.color='#ff6600' }
      if (pct < 0.25) { timerArc.style.stroke='#ff2222'; timerNumber.style.color='#ff2222' }
      if (elapsed >= THROW_TIME_LIMIT) { clearThrowTimer(); disqualify() }
    }, 50)
  }

  function clearThrowTimer() {
    clearInterval(throwTimer); throwTimer = null
    timerWrap.style.display = 'none'
    timerArc.style.strokeDashoffset = '0'; timerArc.style.stroke = '#ff4444'
    timerNumber.textContent = '3'; timerNumber.style.color = '#fff'
  }

  function disqualify() {
    hideBall()
    disqualifEl.style.display = 'flex'
    if (!simulationMode) updateBallState({ status:'idle', holder_id:null, from_id:null, target_id:null })
  }

  document.getElementById('dq-retry').addEventListener('click', () => {
    disqualifEl.style.display = 'none'
    setStatus('En attente de la balle...')
  })

  /* Lance la balle vers un joueur — vérifie si dans le cercle de 50px */
  function throwBallToPlayer(targetPlayer) {
    if (!hasBall) return
    clearThrowTimer()
    throwHint.style.display = 'none'
    const tPos = playerPositionsOnScreen[targetPlayer.id]
    if (!tPos) return

    // Vérifie si la balle est dans le cercle cible de 50px
    const dx = physics.x - tPos.x, dy = physics.y - tPos.y
    const dist = Math.sqrt(dx*dx + dy*dy)

    if (dist <= TARGET_CATCH_RADIUS) {
      // ✅ Lancer valide → envoie la balle vers le bord côté target
      sendBallTo(targetPlayer, tPos)
    } else {
      // ❌ Hors cible → rebond sur le côté
      bounceBack(targetPlayer)
    }
  }

  function sendBallTo(targetPlayer, tPos) {
    const dx = tPos.x - physics.x, dy = tPos.y - physics.y
    const len = Math.sqrt(dx*dx+dy*dy)||1
    physics.throwFree(physics.x, physics.y, dx/len*22, dy/len*22)

    setTimeout(async () => {
      hideBall()
      setStatus(`✅ Envoyée à ${targetPlayer.pseudo} !`)
      if (simulationMode) {
        setTimeout(() => { receiveBall(targetPlayer.id) }, 1800)
      } else {
        await updateBallState({ status:'flying', holder_id:targetPlayer.id, from_id:myId, target_id:targetPlayer.id, updated_at:new Date().toISOString() })
      }
    }, 500)
  }

  function bounceBack(targetPlayer) {
    // Rebond : lancer la balle vers le bord opposé
    const W = window.innerWidth, H = window.innerHeight
    const cx = W/2, cy = H/2
    // Direction aléatoire sur les côtés
    const sides = [
      { vx: -20, vy: (Math.random()-0.5)*10 },  // gauche
      { vx:  20, vy: (Math.random()-0.5)*10 },  // droite
      { vx: (Math.random()-0.5)*10, vy: -20 },  // haut
    ]
    const s = sides[Math.floor(Math.random()*sides.length)]
    physics.friction = 0.973; physics.maxBounces = 4; physics.freeThrow = false
    physics.vx = s.vx; physics.vy = s.vy
    physics.bounceCount = 0; physics.stopped = false; physics.running = true
    physics._tick()
    setStatus(`❌ Raté ! La balle rebondit — rattrape-la !`)
    startThrowTimer()
  }

  /* Drag libre de la balle — attraper n'importe quand même en mouvement */
  let dragOffX = 0, dragOffY = 0, dragVx = 0, dragVy = 0
  let lastDragX = 0, lastDragY = 0, lastDragT = 0

  ballEl.addEventListener('pointerdown', e => {
    if (!hasBall) return
    physics.stop()  // arrête immédiatement même si en mouvement
    ballHeld = true
    ballEl.setPointerCapture(e.pointerId)
    ballEl.classList.add('held')
    throwHint.style.display = 'none'
    dragOffX = e.clientX - physics.x; dragOffY = e.clientY - physics.y
    lastDragX = e.clientX; lastDragY = e.clientY; lastDragT = Date.now()
    dragVx = 0; dragVy = 0
    e.preventDefault()
  })

  ballEl.addEventListener('pointermove', e => {
    if (!ballHeld) return
    const now = Date.now(), dt = Math.max(1, now - lastDragT)
    dragVx = (e.clientX - lastDragX) / dt * 16  // vitesse estimée
    dragVy = (e.clientY - lastDragY) / dt * 16
    lastDragX = e.clientX; lastDragY = e.clientY; lastDragT = now
    physics.setPos(e.clientX - dragOffX, e.clientY - dragOffY)
    e.preventDefault()
  })

  ballEl.addEventListener('pointerup', e => {
    if (!ballHeld) return
    ballHeld = false
    ballEl.classList.remove('held')
    const bx = physics.x, by = physics.y

    // Trouve le joueur le plus proche de la position de lâcher
    let nearestPlayer = null, nearestDist = Infinity
    Object.values(players).forEach(p => {
      if (p.id === myId || !p.latitude) return
      if (distanceMeters(myLat, myLng, p.latitude, p.longitude) > RADIUS_METERS) return
      const pp = playerPositionsOnScreen[p.id]
      if (!pp) return
      const d = Math.sqrt((bx-pp.x)**2 + (by-pp.y)**2)
      if (d < nearestDist) { nearestDist = d; nearestPlayer = p }
    })

    // Si lâché près d'un joueur (< 50px) → lancer valide
    if (nearestPlayer && nearestDist <= TARGET_CATCH_RADIUS) {
      physics.stopped = true
      throwBallToPlayer(nearestPlayer)
    } else if (nearestPlayer) {
      // Lâché hors cible → rebond
      physics.stopped = true
      bounceBack(nearestPlayer)
    } else {
      // Pas de joueur → lance dans la direction du geste
      const speed = Math.sqrt(dragVx*dragVx + dragVy*dragVy)
      if (speed > 2) {
        physics.friction = 0.973; physics.maxBounces = 3; physics.freeThrow = false
        physics.vx = dragVx; physics.vy = dragVy
        physics.bounceCount = 0; physics.stopped = false; physics.running = true
        physics._tick()
        setStatus('Aucun joueur dans cette direction — rattrape !')
      } else {
        physics.stopped = true
        throwHint.style.display = 'block'
        setStatus('⚽ Lance vers un joueur !')
      }
    }
  })

  async function updateBallState(data) {
    if (!sb) return
    await sb.from('ball_state').update({ ...data, updated_at:new Date().toISOString() }).eq('id','current')
  }

  async function updatePosition() {
    if (!myId || myLat===null || simulationMode || !sb) return
    await sb.from('ball_players').upsert({ id:myId, pseudo:myPseudo, latitude:myLat, longitude:myLng, last_seen:new Date().toISOString(), user_id:myUser?.id||null })
  }

  function subscribeRealtime() {
    if (!sb || simulationMode) return
    sb.channel('ball-game-v4')
      .on('postgres_changes',{event:'*',schema:'public',table:'ball_players'}, payload => {
        if (payload.new?.id) { players[payload.new.id]=payload.new; renderPlayers() }
        if (payload.eventType==='DELETE'&&payload.old?.id) { delete players[payload.old.id]; renderPlayers() }
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'ball_state'}, payload => {
        const s = payload.new; if (!s) return
        if (s.status==='flying'&&s.holder_id===myId&&s.from_id!==myId) receiveBall(s.from_id)
        if (s.status==='idle'&&hasBall) { hideBall(); setStatus('En attente de la balle...') }
      })
      .subscribe()
  }

  const getPos = () => new Promise(resolve => {
    if (!navigator.geolocation) { resolve({lat:43.2965,lng:5.3698}); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({lat:p.coords.latitude,lng:p.coords.longitude}),
      () => resolve({lat:43.2965+(Math.random()-.5)*.0003,lng:5.3698+(Math.random()-.5)*.0003}),
      {timeout:6000,enableHighAccuracy:true}
    )
  })

  async function start() {
    const pos = await getPos()
    myLat = pos.lat; myLng = pos.lng

    if (simulationMode) {
      getFakePlayers(myLat, myLng).forEach(p => { players[p.id]=p })
      renderPlayers()
      setTimeout(() => { receiveBall('sim-1'); setStatus('⚽ Balle de Marco — attrape-la !') }, 700)
      return
    }

    await updatePosition(); subscribeRealtime()
    setInterval(() => updatePosition(), 5000)
    const { data: state } = await sb.from('ball_state').select('*').eq('id','current').single()
    if (state && (state.status==='idle'||!state.holder_id)) {
      setTimeout(() => { receiveBall('system'); setStatus('⚽ Tu as la balle !') }, 500)
      await updateBallState({ status:'flying', holder_id:myId, from_id:'system', target_id:myId })
    } else { setStatus('En attente de la balle...') }
  }

  start()

  window.addEventListener('beforeunload', () => {
    if (myId && !simulationMode && sb) sb.from('ball_players').delete().eq('id',myId)
  })
}
