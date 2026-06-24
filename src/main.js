import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mcyhveqbviptpaswadop.supabase.co'
const SUPABASE_KEY = 'sb_publishable_1ZfodYSFYMip8akB3_xmBw_uqCqND9r'
const RADIUS_METERS = 200
const THROW_TIME_LIMIT = 3000

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

let myId = null, myPseudo = '', myLat = null, myLng = null
let players = {}
let hasBall = false, ballHeld = false
let throwTimer = null, throwStart = null
let dragStartX, dragStartY
let channel = null

function uid() { return Math.random().toString(36).substr(2, 9) }
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
  const margin = 48
  const t = Math.min((W/2 - margin) / Math.abs(cos || 0.001), (H/2 - margin) / Math.abs(sin || 0.001))
  return { x: cx + cos * t, y: cy + sin * t }
}

const app = document.getElementById('app')
app.innerHTML = `
<style>
  #game { width:100vw; height:100dvh; position:relative; overflow:hidden; background:#0a1a0a; touch-action:none; }
  svg#field { position:absolute; inset:0; width:100%; height:100%; }
  #hud { position:absolute; top:env(safe-area-inset-top, 12px); left:0; right:0; display:flex; justify-content:center; gap:12px; z-index:10; padding-top:12px; }
  .badge { background:rgba(0,0,0,0.55); border:0.5px solid rgba(255,255,255,0.15); border-radius:20px; padding:5px 14px; font-size:13px; color:rgba(255,255,255,0.85); }
  #timer-badge { color:#ff4444; font-weight:600; display:none; }
  #login { position:absolute; inset:0; background:rgba(10,26,10,0.97); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; z-index:100; }
  #login h1 { color:#7fff7f; font-size:28px; font-weight:500; letter-spacing:3px; }
  #login p { color:rgba(255,255,255,0.45); font-size:14px; }
  #pseudo-input { background:rgba(255,255,255,0.08); border:0.5px solid rgba(255,255,255,0.2); border-radius:10px; padding:12px 20px; color:white; font-size:18px; width:240px; outline:none; text-align:center; }
  #join-btn { background:#1a5c1a; border:0.5px solid #7fff7f; border-radius:10px; padding:12px 32px; color:#7fff7f; font-size:16px; cursor:pointer; letter-spacing:1px; }
  #login-status { color:rgba(255,200,100,0.7); font-size:12px; min-height:16px; }
  #ball { position:absolute; width:52px; height:52px; border-radius:50%; background:radial-gradient(circle at 35% 35%, #fff 0%, #ccc 40%, #888 100%); border:2px solid rgba(255,255,255,0.3); cursor:grab; display:none; z-index:20; box-shadow:0 0 18px rgba(255,255,255,0.3); }
  #ball.held { cursor:grabbing; box-shadow:0 0 36px rgba(255,255,128,0.7); }
  #ball.incoming { animation:pop 0.3s ease-out; }
  @keyframes pop { from { transform:scale(0.3); opacity:0; } to { transform:scale(1); opacity:1; } }
  .player-indicator { position:absolute; display:flex; flex-direction:column; align-items:center; gap:5px; z-index:15; transform:translate(-50%,-50%); cursor:pointer; }
  .player-dot { width:16px; height:16px; border-radius:50%; background:#4fc3f7; border:2px solid rgba(255,255,255,0.5); animation:breathe 2s ease-in-out infinite; }
  .player-label { background:rgba(0,0,0,0.65); border-radius:12px; padding:3px 9px; font-size:12px; color:rgba(255,255,255,0.85); white-space:nowrap; }
  @keyframes breathe { 0%,100%{opacity:0.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.25)} }
  #status { position:absolute; bottom:env(safe-area-inset-bottom, 20px); left:0; right:0; text-align:center; font-size:14px; color:rgba(255,255,255,0.45); z-index:10; padding-bottom:20px; }
  .trail { position:absolute; border-radius:50%; background:rgba(255,255,200,0.5); pointer-events:none; z-index:19; transition:opacity 0.1s; }
</style>

<div id="game">
  <svg id="field" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="390" height="844" fill="#0a1a0a"/>
    <rect x="20" y="40" width="350" height="764" rx="10" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/>
    <line x1="20" y1="422" x2="370" y2="422" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <circle cx="195" cy="422" r="70" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <circle cx="195" cy="422" r="5" fill="rgba(255,255,255,0.12)"/>
    <rect x="20" y="310" width="70" height="204" rx="4" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <rect x="300" y="310" width="70" height="204" rx="4" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  </svg>

  <div id="hud">
    <div class="badge" id="pseudo-badge">—</div>
    <div class="badge" id="players-badge">0 joueur</div>
    <div class="badge" id="timer-badge">3s</div>
  </div>

  <div id="ball"></div>
  <div id="status">En attente...</div>

  <div id="login">
    <h1>⚽ THE BALL</h1>
    <p>Entre dans la partie</p>
    <input id="pseudo-input" type="text" placeholder="Ton pseudo" maxlength="12" autocomplete="off" autocorrect="off"/>
    <button id="join-btn">REJOINDRE</button>
    <div id="login-status"></div>
  </div>
</div>
`

const game = document.getElementById('game')
const ballEl = document.getElementById('ball')
const loginEl = document.getElementById('login')
const pseudoBadge = document.getElementById('pseudo-badge')
const playersBadge = document.getElementById('players-badge')
const timerBadge = document.getElementById('timer-badge')
const statusEl = document.getElementById('status')
const loginStatus = document.getElementById('login-status')

function setStatus(msg) { statusEl.textContent = msg }

function renderPlayers() {
  document.querySelectorAll('.player-indicator').forEach(e => e.remove())
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
    el.className = 'player-indicator'
    el.style.left = pos.x + 'px'
    el.style.top = pos.y + 'px'
    el.dataset.playerId = p.id
    el.innerHTML = `<div class="player-dot"></div><div class="player-label">${p.pseudo}</div>`
    el.addEventListener('click', () => { if (hasBall) throwBallTo(p) })
    el.addEventListener('touchend', (e) => { e.preventDefault(); if (hasBall) throwBallTo(p) })
    game.appendChild(el)
  })
  playersBadge.textContent = count === 0 ? '0 joueur' : count === 1 ? '1 joueur' : count + ' joueurs'
}

function showBallAt(x, y) {
  ballEl.style.display = 'block'
  ballEl.style.left = (x - 26) + 'px'
  ballEl.style.top = (y - 26) + 'px'
}

function hideBall() {
  ballEl.style.display = 'none'
  hasBall = false
  ballHeld = false
  clearThrowTimer()
}

function receiveBall(fromId) {
  hasBall = true
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2
  ballEl.className = 'incoming'
  showBallAt(cx, cy)
  const fromPlayer = players[fromId]
  const name = fromPlayer ? fromPlayer.pseudo : '???'
  setStatus(`⚽ Balle reçue de ${name} — lance en moins de 3s !`)
  startThrowTimer()
  setTimeout(() => { if (ballEl.className === 'incoming') ballEl.className = '' }, 400)
}

function startThrowTimer() {
  clearThrowTimer()
  throwStart = Date.now()
  timerBadge.style.display = 'block'
  timerBadge.style.color = '#ff4444'
  throwTimer = setInterval(() => {
    const elapsed = Date.now() - throwStart
    const remaining = Math.max(0, Math.ceil((THROW_TIME_LIMIT - elapsed) / 1000))
    timerBadge.textContent = remaining + 's'
    if (remaining <= 1) timerBadge.style.color = '#ff2222'
    if (elapsed >= THROW_TIME_LIMIT) { clearThrowTimer(); disqualify() }
  }, 100)
}

function clearThrowTimer() {
  clearInterval(throwTimer)
  throwTimer = null
  timerBadge.style.display = 'none'
}

function disqualify() {
  hideBall()
  setStatus('⚠ Trop lent ! Balle perdue.')
  updateBallState({ status: 'idle', holder_id: null, from_id: null, target_id: null })
}

async function throwBallTo(targetPlayer) {
  if (!hasBall) return
  clearThrowTimer()
  animateThrowTo(targetPlayer)
  setTimeout(async () => {
    hideBall()
    setStatus(`Balle envoyée à ${targetPlayer.pseudo} !`)
    await updateBallState({ status: 'flying', holder_id: targetPlayer.id, from_id: myId, target_id: targetPlayer.id, updated_at: new Date().toISOString() })
  }, 350)
}

function animateThrowTo(targetPlayer) {
  const bearing = bearingDeg(myLat, myLng, targetPlayer.latitude, targetPlayer.longitude)
  const endPos = getEdgePosition(bearing)
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2
  let t = 0
  const trail = document.createElement('div')
  trail.className = 'trail'
  trail.style.cssText = `width:24px;height:24px;left:${cx-12}px;top:${cy-12}px;`
  game.appendChild(trail)
  const anim = setInterval(() => {
    t += 0.07
    const x = cx + (endPos.x - cx) * t
    const y = cy + (endPos.y - cy) * t
    trail.style.left = (x - 12) + 'px'
    trail.style.top = (y - 12) + 'px'
    trail.style.opacity = String(1 - t)
    if (t >= 1) { clearInterval(anim); trail.remove() }
  }, 16)
}

async function updateBallState(data) {
  await sb.from('ball_state').update({ ...data, updated_at: new Date().toISOString() }).eq('id', 'current')
}

async function updatePosition() {
  if (!myId || myLat === null) return
  await sb.from('ball_players').upsert({ id: myId, pseudo: myPseudo, latitude: myLat, longitude: myLng, last_seen: new Date().toISOString() })
}

async function fetchPlayers() {
  const since = new Date(Date.now() - 30000).toISOString()
  const { data } = await sb.from('ball_players').select('*').gte('last_seen', since)
  if (data) { players = {}; data.forEach(p => { players[p.id] = p }); renderPlayers() }
}

function subscribeRealtime() {
  channel = sb.channel('ball-game-v1')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_players' }, payload => {
      if (payload.new && payload.new.id) { players[payload.new.id] = payload.new; renderPlayers() }
      if (payload.eventType === 'DELETE' && payload.old) { delete players[payload.old.id]; renderPlayers() }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ball_state' }, payload => {
      const state = payload.new
      if (!state) return
      if (state.status === 'flying' && state.holder_id === myId && state.from_id !== myId) {
        receiveBall(state.from_id)
      }
      if (state.status === 'idle' && hasBall) { hideBall(); setStatus('En attente de la balle...') }
    })
    .subscribe()
}

ballEl.addEventListener('pointerdown', e => {
  if (!hasBall) return
  ballHeld = true
  ballEl.setPointerCapture(e.pointerId)
  ballEl.classList.add('held')
  dragStartX = e.clientX
  dragStartY = e.clientY
  e.preventDefault()
})

ballEl.addEventListener('pointermove', e => {
  if (!ballHeld) return
  showBallAt(e.clientX, e.clientY)
  e.preventDefault()
})

ballEl.addEventListener('pointerup', e => {
  if (!ballHeld) return
  ballHeld = false
  ballEl.classList.remove('held')
  const x = e.clientX, y = e.clientY
  const W = window.innerWidth, H = window.innerHeight
  const margin = 70
  if (x < margin || x > W - margin || y < margin || y > H - margin) {
    const dx = x - W/2, dy = y - H/2
    const bearing = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360
    const target = findNearestPlayerInDirection(bearing)
    if (target) {
      throwBallTo(target)
    } else {
      setStatus('Aucun joueur dans cette direction !')
      showBallAt(W/2, H/2)
    }
  } else {
    showBallAt(x, y)
  }
})

function findNearestPlayerInDirection(bearing) {
  let best = null, bestDiff = 50
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

async function startGame(pseudo) {
  myId = uid()
  myPseudo = pseudo
  loginStatus.textContent = 'Géolocalisation en cours...'

  const getPos = () => new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ lat: 43.2965, lng: 5.3698 }); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: 43.2965 + (Math.random()-0.5)*0.001, lng: 5.3698 + (Math.random()-0.5)*0.001 }),
      { timeout: 6000, enableHighAccuracy: true }
    )
  })

  const pos = await getPos()
  myLat = pos.lat
  myLng = pos.lng

  pseudoBadge.textContent = myPseudo
  await updatePosition()
  await fetchPlayers()
  subscribeRealtime()
  setInterval(async () => { await updatePosition(); await fetchPlayers() }, 5000)

  loginEl.style.display = 'none'
  setStatus('Connecté ! En attente de la balle...')

  const { data: state } = await sb.from('ball_state').select('*').eq('id', 'current').single()
  if (state && (state.status === 'idle' || !state.holder_id)) {
    hasBall = true
    showBallAt(window.innerWidth / 2, window.innerHeight / 2)
    setStatus('⚽ Tu as la balle ! Lance-la !')
    startThrowTimer()
    await updateBallState({ status: 'flying', holder_id: myId, from_id: 'system', target_id: myId })
  }
}

document.getElementById('join-btn').addEventListener('click', () => {
  const pseudo = document.getElementById('pseudo-input').value.trim()
  if (pseudo.length < 2) return
  startGame(pseudo)
})
document.getElementById('pseudo-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('join-btn').click()
})

window.addEventListener('beforeunload', () => {
  if (myId) sb.from('ball_players').delete().eq('id', myId)
})
