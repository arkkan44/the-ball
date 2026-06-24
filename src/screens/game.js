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

// 5 faux joueurs simulés autour de Marseille
function getFakePlayers(myLat, myLng) {
  const offset = 0.0005 // ~55m
  return [
    { id: 'sim-1', pseudo: 'Marco', latitude: myLat + offset, longitude: myLng + offset * 0.5, sim: true },
    { id: 'sim-2', pseudo: 'Sofia', latitude: myLat - offset * 0.8, longitude: myLng + offset, sim: true },
    { id: 'sim-3', pseudo: 'Karim', latitude: myLat + offset * 0.3, longitude: myLng - offset, sim: true },
    { id: 'sim-4', pseudo: 'Jade', latitude: myLat - offset, longitude: myLng - offset * 0.6, sim: true },
    { id: 'sim-5', pseudo: 'Théo', latitude: myLat + offset * 1.2, longitude: myLng + offset * 0.2, sim: true },
  ]
}

export function renderGame() {
  return `
  <style>
    * { -webkit-tap-highlight-color: transparent; }
    #game {
      position: fixed; inset: 0; overflow: hidden;
      background: #0a1a0a; touch-action: none;
      font-family: system-ui, sans-serif;
    }
    #field-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    #hud {
      position: absolute; top: env(safe-area-inset-top, 0px);
      left: 0; right: 0; display: flex; justify-content: center;
      gap: 10px; z-index: 20; padding-top: 14px;
    }
    .badge {
      background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
      border: 0.5px solid rgba(255,255,255,0.12); border-radius: 20px;
      padding: 6px 14px; font-size: 13px; color: rgba(255,255,255,0.8);
    }
    #timer-badge { color: #ff4444; font-weight: 700; display: none; font-size: 15px; }
    #sim-badge { background: rgba(79,195,247,0.15); border-color: rgba(79,195,247,0.3); color: #4fc3f7; display: none; }
    #ball {
      position: absolute; width: 56px; height: 56px; border-radius: 50%;
      display: none; z-index: 30; cursor: grab;
      box-shadow: 0 0 20px rgba(255,255,255,0.3);
      transition: box-shadow 0.15s;
      /* Soccer ball pattern */
      background:
        radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9) 0%, rgba(200,200,200,0.6) 40%, transparent 70%),
        radial-gradient(circle at 65% 65%, rgba(0,0,0,0.15) 0%, transparent 50%),
        #ddd;
    }
    #ball::before {
      content: '⚽';
      position: absolute; inset: 0; display: flex;
      align-items: center; justify-content: center;
      font-size: 42px; line-height: 1;
    }
    #ball.held { cursor: grabbing; box-shadow: 0 0 40px rgba(255,255,128,0.8); }
    #ball.incoming { animation: ballPop 0.4s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes ballPop { from{transform:scale(0) rotate(-180deg);opacity:0} to{transform:scale(1) rotate(0deg);opacity:1} }
    .player-dot-wrap {
      position: absolute; display: flex; flex-direction: column;
      align-items: center; gap: 5px; z-index: 25;
      transform: translate(-50%, -50%); cursor: pointer;
    }
    .player-dot {
      width: 18px; height: 18px; border-radius: 50%;
      background: #4fc3f7; border: 2px solid rgba(255,255,255,0.6);
      box-shadow: 0 0 10px rgba(79,195,247,0.5);
      animation: playerBreath 2.5s ease-in-out infinite;
    }
    .player-dot.sim-dot { background: #ff9f4a; box-shadow: 0 0 10px rgba(255,159,74,0.5); }
    .player-label {
      background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
      border-radius: 12px; padding: 3px 10px;
      font-size: 12px; color: rgba(255,255,255,0.9); white-space: nowrap;
      border: 0.5px solid rgba(255,255,255,0.1);
    }
    @keyframes playerBreath { 0%,100%{transform:scale(1);opacity:0.8} 50%{transform:scale(1.3);opacity:1} }
    .trail {
      position: absolute; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,200,0.8), transparent);
      pointer-events: none; z-index: 28;
    }
    #status-bar {
      position: absolute; bottom: env(safe-area-inset-bottom, 0px);
      left: 0; right: 0; text-align: center;
      font-size: 14px; color: rgba(255,255,255,0.45);
      z-index: 20; padding-bottom: 24px;
      background: linear-gradient(to top, rgba(0,0,0,0.3), transparent);
      padding-top: 20px;
    }
    #timer-ring {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 22; display: none; pointer-events: none;
    }
    #timer-ring circle { transition: stroke-dashoffset 0.1s linear; }
    .throw-hint {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, calc(-50% + 50px));
      color: rgba(255,255,255,0.25); font-size: 12px;
      z-index: 21; pointer-events: none; text-align: center;
      display: none; letter-spacing: 1px;
    }
  </style>

  <div id="game">
    <svg id="field-svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <!-- Fond terrain de foot sombre -->
      <defs>
        <linearGradient id="grassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#0d1f0d"/>
          <stop offset="50%" style="stop-color:#0a1a0a"/>
          <stop offset="100%" style="stop-color:#0d1f0d"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="390" height="844" fill="url(#grassGrad)"/>
      <!-- Lignes de terrain subtiles -->
      <rect x="18" y="35" width="354" height="774" rx="10" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.5" filter="url(#glow)"/>
      <!-- Ligne médiane -->
      <line x1="18" y1="422" x2="372" y2="422" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <!-- Rond central -->
      <circle cx="195" cy="422" r="65" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <circle cx="195" cy="422" r="3" fill="rgba(255,255,255,0.2)"/>
      <!-- Surface de réparation haut -->
      <rect x="93" y="35" width="204" height="110" rx="3" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <rect x="143" y="35" width="104" height="55" rx="3" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <!-- Surface de réparation bas -->
      <rect x="93" y="699" width="204" height="110" rx="3" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <rect x="143" y="754" width="104" height="55" rx="3" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <!-- Corners -->
      <path d="M18,55 Q28,35 38,55" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <path d="M352,55 Q362,35 372,55" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <path d="M18,789 Q28,809 38,789" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <path d="M352,789 Q362,809 372,789" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
      <!-- Points de penalty -->
      <circle cx="195" cy="130" r="2.5" fill="rgba(255,255,255,0.15)"/>
      <circle cx="195" cy="714" r="2.5" fill="rgba(255,255,255,0.15)"/>
    </svg>

    <div id="hud">
      <div class="badge" id="pseudo-badge">—</div>
      <div class="badge" id="players-badge">0 joueur</div>
      <div class="badge" id="timer-badge">3s</div>
      <div class="badge" id="sim-badge">🤖 SIMULATION</div>
    </div>

    <svg id="timer-ring" width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,68,68,0.15)" stroke-width="4"/>
      <circle id="timer-arc" cx="50" cy="50" r="44" fill="none" stroke="#ff4444" stroke-width="4"
        stroke-linecap="round" stroke-dasharray="276.5" stroke-dashoffset="0"
        transform="rotate(-90 50 50)"/>
    </svg>

    <div id="ball"></div>
    <div class="throw-hint" id="throw-hint">GLISSE VERS UN JOUEUR</div>
    <div id="status-bar">En attente...</div>
  </div>
  `
}

export function initGame(sb, myUser, myPseudo, simulationMode = false) {
  let myId = myUser?.id || ('guest-' + Math.random().toString(36).substr(2, 6))
  let myLat = null, myLng = null
  let players = {}
  let hasBall = false, ballHeld = false
  let throwTimer = null, throwStart = null
  let channel = null

  const game = document.getElementById('game')
  const ballEl = document.getElementById('ball')
  const pseudoBadge = document.getElementById('pseudo-badge')
  const playersBadge = document.getElementById('players-badge')
  const timerBadge = document.getElementById('timer-badge')
  const timerRing = document.getElementById('timer-ring')
  const timerArc = document.getElementById('timer-arc')
  const statusEl = document.getElementById('status-bar')
  const simBadge = document.getElementById('sim-badge')
  const throwHint = document.getElementById('throw-hint')

  pseudoBadge.textContent = myPseudo
  if (simulationMode) simBadge.style.display = 'block'

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
      el.style.top = pos.y + 'px'
      el.dataset.pid = p.id
      el.innerHTML = `<div class="player-dot${p.sim ? ' sim-dot' : ''}"></div><div class="player-label">${p.pseudo}</div>`
      el.addEventListener('pointerup', () => { if (hasBall) throwBallTo(p) })
      game.appendChild(el)
    })
    playersBadge.textContent = count === 0 ? '0 joueur' : count === 1 ? '1 joueur' : count + ' joueurs'
  }

  function showBallAt(x, y) {
    ballEl.style.display = 'block'
    ballEl.style.left = (x - 28) + 'px'
    ballEl.style.top = (y - 28) + 'px'
  }

  function hideBall() {
    ballEl.style.display = 'none'
    hasBall = false
    ballHeld = false
    throwHint.style.display = 'none'
    clearThrowTimer()
  }

  function receiveBall(fromId) {
    hasBall = true
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2
    ballEl.className = 'incoming'
    showBallAt(cx, cy)
    setTimeout(() => { ballEl.classList.remove('incoming') }, 500)
    const from = players[fromId]
    setStatus(from ? `⚽ Reçue de ${from.pseudo} — 3 secondes !` : '⚽ Tu as la balle !')
    throwHint.style.display = 'block'
    startThrowTimer()

    if (simulationMode) {
      setTimeout(() => {
        if (hasBall) setStatus('👆 Glisse la balle vers un joueur orange !')
      }, 800)
    }
  }

  function startThrowTimer() {
    clearThrowTimer()
    throwStart = Date.now()
    timerBadge.style.display = 'block'
    timerBadge.style.color = '#ff4444'
    timerRing.style.display = 'block'
    const circumference = 276.5
    throwTimer = setInterval(() => {
      const elapsed = Date.now() - throwStart
      const pct = Math.max(0, 1 - elapsed / THROW_TIME_LIMIT)
      const remaining = Math.max(0, Math.ceil((THROW_TIME_LIMIT - elapsed) / 1000))
      timerBadge.textContent = remaining + 's'
      timerArc.style.strokeDashoffset = circumference * (1 - pct)
      if (pct < 0.33) { timerBadge.style.color = '#ff2222'; timerArc.style.stroke = '#ff2222' }
      if (elapsed >= THROW_TIME_LIMIT) { clearThrowTimer(); disqualify() }
    }, 50)
  }

  function clearThrowTimer() {
    clearInterval(throwTimer)
    throwTimer = null
    timerBadge.style.display = 'none'
    timerRing.style.display = 'none'
    timerArc.style.strokeDashoffset = 0
    timerArc.style.stroke = '#ff4444'
  }

  function disqualify() {
    hideBall()
    setStatus('⚠ Trop lent — balle perdue !')
    if (!simulationMode) updateBallState({ status: 'idle', holder_id: null, from_id: null, target_id: null })
  }

  async function throwBallTo(targetPlayer) {
    if (!hasBall) return
    clearThrowTimer()
    throwHint.style.display = 'none'
    animateThrow(targetPlayer)
    setTimeout(async () => {
      hideBall()
      setStatus(`✅ Envoyée à ${targetPlayer.pseudo} !`)
      if (simulationMode) {
        // Simulation : la balle revient après 2s
        setTimeout(() => {
          receiveBall(targetPlayer.id)
        }, 1800)
      } else {
        await updateBallState({ status: 'flying', holder_id: targetPlayer.id, from_id: myId, target_id: targetPlayer.id, updated_at: new Date().toISOString() })
      }
    }, 350)
  }

  function animateThrow(targetPlayer) {
    const bearing = bearingDeg(myLat, myLng, targetPlayer.latitude, targetPlayer.longitude)
    const endPos = getEdgePosition(bearing)
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2
    let t = 0
    const trail = document.createElement('div')
    trail.className = 'trail'
    trail.style.cssText = `width:28px;height:28px;left:${cx-14}px;top:${cy-14}px;position:absolute;`
    game.appendChild(trail)
    const anim = setInterval(() => {
      t += 0.065
      const x = cx + (endPos.x - cx) * t
      const y = cy + (endPos.y - cy) * t
      trail.style.left = (x-14) + 'px'
      trail.style.top = (y-14) + 'px'
      trail.style.opacity = String(Math.max(0, 1-t))
      if (t >= 1) { clearInterval(anim); trail.remove() }
    }, 16)
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
    channel = sb.channel('ball-game-v2')
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

  // Drag de la balle
  ballEl.addEventListener('pointerdown', e => {
    if (!hasBall) return
    ballHeld = true
    ballEl.setPointerCapture(e.pointerId)
    ballEl.classList.add('held')
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
    const margin = 72
    if (x < margin || x > W - margin || y < margin || y > H - margin) {
      const dx = x - W/2, dy = y - H/2
      const bearing = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360
      const target = findNearestInDirection(bearing)
      if (target) { throwBallTo(target) }
      else { setStatus('Aucun joueur dans cette direction !'); showBallAt(W/2, H/2) }
    } else {
      showBallAt(x, y)
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

  // Init géoloc
  const getPos = () => new Promise(resolve => {
    if (!navigator.geolocation) { resolve({ lat: 43.2965, lng: 5.3698 }); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({ lat: 43.2965 + (Math.random()-0.5)*0.0003, lng: 5.3698 + (Math.random()-0.5)*0.0003 }),
      { timeout: 6000, enableHighAccuracy: true }
    )
  })

  async function start() {
    const pos = await getPos()
    myLat = pos.lat
    myLng = pos.lng

    if (simulationMode) {
      const fakes = getFakePlayers(myLat, myLng)
      fakes.forEach(p => { players[p.id] = p })
      renderPlayers()
      setStatus('🤖 Simulation — tu as la balle !')
      setTimeout(() => {
        hasBall = true
        showBallAt(window.innerWidth/2, window.innerHeight/2)
        ballEl.className = 'incoming'
        setTimeout(() => ballEl.classList.remove('incoming'), 500)
        throwHint.style.display = 'block'
        startThrowTimer()
        setStatus('⚽ Tu as la balle ! Lance-la vers un joueur orange !')
      }, 800)
      return
    }

    await updatePosition()
    subscribeRealtime()
    setInterval(() => updatePosition(), 5000)

    const { data: state } = await sb.from('ball_state').select('*').eq('id', 'current').single()
    if (state && (state.status === 'idle' || !state.holder_id)) {
      hasBall = true
      showBallAt(window.innerWidth/2, window.innerHeight/2)
      setStatus('⚽ Tu as la balle ! Lance-la !')
      startThrowTimer()
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
