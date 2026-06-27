import { playKickReceive, playKickLaunch, unlockAudio } from '../sounds.js'

const RADIUS_METERS = 999999
const THROW_TIME_LIMIT = 10000
const HALF_CIRCLE_R = 60

function degToRad(d) { return d * Math.PI / 180 }
function distanceMeters(lat1,lng1,lat2,lng2) {
  const R=6371000,dLat=degToRad(lat2-lat1),dLng=degToRad(lng2-lng1)
  const a=Math.sin(dLat/2)**2+Math.cos(degToRad(lat1))*Math.cos(degToRad(lat2))*Math.sin(dLng/2)**2
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}
function bearingDeg(lat1,lng1,lat2,lng2) {
  const dLng=degToRad(lng2-lng1)
  const y=Math.sin(dLng)*Math.cos(degToRad(lat2))
  const x=Math.cos(degToRad(lat1))*Math.sin(degToRad(lat2))-Math.sin(degToRad(lat1))*Math.cos(degToRad(lat2))*Math.cos(dLng)
  return (Math.atan2(y,x)*180/Math.PI+360)%360
}
function getEdgePosition(bearing) {
  const W=window.innerWidth,H=window.innerHeight,cx=W/2,cy=H/2
  const angle=(bearing-90)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),margin=52
  const t=Math.min((W/2-margin)/Math.abs(cos||0.001),(H/2-margin)/Math.abs(sin||0.001))
  return {x:cx+cos*t,y:cy+sin*t,bearing}
}
function getFakePlayers(myLat,myLng) {
  const o=0.0005
  return [
    {id:'sim-1',pseudo:'Marco', latitude:myLat+o,     longitude:myLng+o*0.5, sim:true},
    {id:'sim-2',pseudo:'Sofia', latitude:myLat-o*0.8, longitude:myLng+o,     sim:true},
    {id:'sim-3',pseudo:'Karim', latitude:myLat+o*0.3, longitude:myLng-o,     sim:true},
    {id:'sim-4',pseudo:'Jade',  latitude:myLat-o,     longitude:myLng-o*0.6, sim:true},
    {id:'sim-5',pseudo:'Théo',  latitude:myLat+o*1.2, longitude:myLng+o*0.2, sim:true},
  ]
}

// Repositionne tous les joueurs aléatoirement autour de myLat/myLng
function shufflePlayerPositions(players, myLat, myLng) {
  const angles = []
  // Génère des angles bien espacés pour éviter deux joueurs au même endroit
  const base = Math.random() * 360
  const count = Object.keys(players).length
  Object.values(players).forEach((p, i) => {
    // Angle de base réparti + perturbation aléatoire
    const angle = (base + (360 / count) * i + (Math.random() - 0.5) * 40) % 360
    const rad = angle * Math.PI / 180
    const dist = 0.0003 + Math.random() * 0.0004  // entre ~30m et ~70m
    p.latitude  = myLat + Math.cos(rad) * dist
    p.longitude = myLng + Math.sin(rad) * dist
  })
}

/* ══ TERRAIN ══ */
function drawField(canvas) {
  const W=canvas.width=window.innerWidth,H=canvas.height=window.innerHeight
  const ctx=canvas.getContext('2d')
  const bg=ctx.createLinearGradient(0,0,0,H)
  bg.addColorStop(0,'#081508');bg.addColorStop(0.5,'#0b1d0b');bg.addColorStop(1,'#081508')
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)
  for(let i=0;i<10;i++){ctx.fillStyle=i%2===0?'rgba(255,255,255,0.012)':'rgba(0,0,0,0)';ctx.fillRect(i*W/10,0,W/10,H)}
  const lc='rgba(255,255,255,0.2)',lw=1.8
  ctx.strokeStyle=lc;ctx.lineWidth=lw;ctx.lineCap='round'
  const pad=22,fw=W-pad*2,fh=H-pad*2,fx=pad,fy=pad
  const s=(fn)=>{ctx.beginPath();fn();ctx.stroke()}
  ctx.strokeRect(fx,fy,fw,fh)
  s(()=>{ctx.moveTo(fx,fy+fh/2);ctx.lineTo(fx+fw,fy+fh/2)})
  const ccx=fx+fw/2,ccy=fy+fh/2
  s(()=>ctx.arc(ccx,ccy,Math.min(fw,fh)*0.13,0,Math.PI*2))
  ctx.beginPath();ctx.arc(ccx,ccy,3,0,Math.PI*2);ctx.fillStyle=lc;ctx.fill()
  const bw=fw*0.55,bh=fh*0.18,bx=fx+(fw-bw)/2
  ctx.strokeRect(bx,fy,bw,bh);ctx.strokeRect(bx,fy+fh-bh,bw,bh)
  const sw2=fw*0.28,sh=fh*0.09,sx=fx+(fw-sw2)/2
  ctx.strokeRect(sx,fy,sw2,sh);ctx.strokeRect(sx,fy+fh-sh,sw2,sh)
  ;[[ccx,fy+bh,1],[ccx,fy+fh-bh,0]].forEach(([acx,acy,flip])=>{
    ctx.save();ctx.beginPath();ctx.rect(bx,flip?fy+fh-bh-fh*0.12:fy+bh,bw,fh*0.12);ctx.clip()
    s(()=>ctx.arc(acx,acy,Math.min(fw,fh)*0.11,flip?Math.PI:0,flip?Math.PI*2:Math.PI));ctx.restore()
  })
  ;[[ccx,fy+fh*0.13],[ccx,fy+fh*0.87]].forEach(([px,py])=>{ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fillStyle=lc;ctx.fill()})
  const cr=12
  ;[[fx,fy,0,Math.PI/2],[fx+fw,fy,Math.PI/2,Math.PI],[fx,fy+fh,-Math.PI/2,0],[fx+fw,fy+fh,Math.PI,-Math.PI/2]].forEach(([x,y,a1,a2])=>s(()=>ctx.arc(x,y,cr,a1,a2)))
  const gw=fw*0.22,gh=fh*0.025,gx=fx+(fw-gw)/2
  ctx.strokeStyle='rgba(255,255,255,0.28)';ctx.lineWidth=2.5
  ctx.strokeRect(gx,fy-gh,gw,gh);ctx.strokeRect(gx,fy+fh,gw,gh)
}

function drawHalfCircles(overlayCanvas,playerPositions) {
  const W=overlayCanvas.width=window.innerWidth,H=overlayCanvas.height=window.innerHeight
  const ctx=overlayCanvas.getContext('2d');ctx.clearRect(0,0,W,H)
  const cx=W/2,cy=H/2
  Object.values(playerPositions).forEach(({pos,player})=>{
    const px=pos.x,py=pos.y
    const inDx=cx-px,inDy=cy-py,inLen=Math.sqrt(inDx*inDx+inDy*inDy)
    const inNx=inDx/inLen,inNy=inDy/inLen
    const inwardAngle=Math.atan2(inNy,inNx)
    const a1=inwardAngle-Math.PI/2,a2=inwardAngle+Math.PI/2
    ctx.beginPath();ctx.moveTo(px,py);ctx.arc(px,py,HALF_CIRCLE_R,a1,a2);ctx.closePath()
    ctx.fillStyle=player.sim?'rgba(255,159,74,0.15)':'rgba(127,255,127,0.12)';ctx.fill()
    ctx.beginPath();ctx.arc(px,py,HALF_CIRCLE_R,a1,a2)
    ctx.setLineDash([6,4]);ctx.strokeStyle=player.sim?'rgba(255,159,74,0.7)':'rgba(127,255,127,0.65)';ctx.lineWidth=2;ctx.stroke()
    const perpX=-inNy,perpY=inNx
    ctx.beginPath();ctx.moveTo(px+perpX*HALF_CIRCLE_R,py+perpY*HALF_CIRCLE_R);ctx.lineTo(px-perpX*HALF_CIRCLE_R,py-perpY*HALF_CIRCLE_R)
    ctx.setLineDash([4,3]);ctx.strokeStyle=player.sim?'rgba(255,159,74,0.4)':'rgba(127,255,127,0.35)';ctx.lineWidth=1.5;ctx.stroke()
    ctx.setLineDash([])
  })
}

function isInHalfCircle(bx,by,playerPos) {
  const W=window.innerWidth,H=window.innerHeight,cx=W/2,cy=H/2
  const inDx=cx-playerPos.x,inDy=cy-playerPos.y,inLen=Math.sqrt(inDx*inDx+inDy*inDy)
  const inNx=inDx/inLen,inNy=inDy/inLen
  const dx=bx-playerPos.x,dy=by-playerPos.y
  const dist=Math.sqrt(dx*dx+dy*dy)
  if(dist>HALF_CIRCLE_R)return false
  return dx*inNx+dy*inNy>=0
}

/* ══ PHYSIQUE ══ */
class BallPhysics {
  constructor(ballEl,onStop,onBounce){
    this.el=ballEl;this.onStop=onStop;this.onBounce=onBounce
    this.x=0;this.y=0;this.vx=0;this.vy=0;this.R=28
    this.friction=0.973;this.running=false;this.stopped=true;this.raf=null
    this.bounceCount=0;this.maxBounces=3;this.freeThrow=false
  }
  launch(sx,sy,tx,ty,speed=17){
    this.x=sx;this.y=sy
    const dx=tx-sx,dy=ty-sy,len=Math.sqrt(dx*dx+dy*dy)||1
    this.vx=dx/len*speed;this.vy=dy/len*speed
    this.bounceCount=0;this.stopped=false;this.running=true
    this.freeThrow=false;this.friction=0.973;this.maxBounces=3
    this.el.style.display='block';cancelAnimationFrame(this.raf);this._tick()
  }
  throwFree(sx,sy,vx,vy){
    this.x=sx;this.y=sy;this.vx=vx;this.vy=vy
    this.bounceCount=0;this.stopped=false;this.running=true
    this.freeThrow=true;this.friction=1.0
    this.el.style.display='block';cancelAnimationFrame(this.raf);this._tick()
  }
  _tick(){
    if(!this.running)return
    const W=window.innerWidth,H=window.innerHeight
    this.x+=this.vx;this.y+=this.vy;this.vx*=this.friction;this.vy*=this.friction
    let bounced=false
    if(!this.freeThrow){
      if(this.x-this.R<0){this.x=this.R;this.vx=Math.abs(this.vx);bounced=true}
      else if(this.x+this.R>W){this.x=W-this.R;this.vx=-Math.abs(this.vx);bounced=true}
      if(this.y-this.R<0){this.y=this.R;this.vy=Math.abs(this.vy);bounced=true}
      else if(this.y+this.R>H){this.y=H-this.R;this.vy=-Math.abs(this.vy);bounced=true}
      if(bounced){this.bounceCount++;if(this.onBounce)this.onBounce(this.bounceCount)}
    } else {
      if(this.x<-80||this.x>W+80||this.y<-80||this.y>H+80){this.running=false;this.stopped=true;return}
    }
    this.el.style.left=(this.x-28)+'px';this.el.style.top=(this.y-28)+'px'
    const spd=Math.sqrt(this.vx*this.vx+this.vy*this.vy)
    if(!this.freeThrow&&(spd<0.5||(this.bounceCount>=this.maxBounces&&spd<2.5))){
      this.running=false;this.stopped=true;if(this.onStop)this.onStop(this.x,this.y);return
    }
    this.raf=requestAnimationFrame(()=>this._tick())
  }
  stop(){this.running=false;cancelAnimationFrame(this.raf);this.stopped=true}
  setPos(x,y){this.x=x;this.y=y;this.el.style.left=(x-28)+'px';this.el.style.top=(y-28)+'px'}
}

/* ══ HTML ══ */
export function renderGame() {
  return `
<style>
  *,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
  html,body{width:100%;height:100%;overflow:hidden}
  #game{position:fixed;inset:0;width:100vw;height:100dvh;overflow:hidden;touch-action:none;font-family:system-ui,sans-serif}
  #field-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0}
  #overlay-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:5;pointer-events:none}

  /* ── HUD ── */
  #hud{position:absolute;top:env(safe-area-inset-top,0px);left:0;right:0;display:flex;justify-content:center;gap:10px;z-index:40;padding-top:14px}
  .badge{background:rgba(0,0,0,0.65);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:0.5px solid rgba(255,255,255,0.13);border-radius:20px;padding:6px 14px;font-size:13px;color:rgba(255,255,255,0.85)}
  #sim-badge{background:rgba(79,195,247,0.18);border-color:rgba(79,195,247,0.35);color:#4fc3f7;display:none}

  /* ── LOBBY ── */
  #lobby-screen{
    position:absolute;inset:0;z-index:80;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;
    background:rgba(8,21,8,0.92);backdrop-filter:blur(8px);
  }
  #lobby-screen .lobby-title{font-size:28px;font-weight:300;letter-spacing:5px;color:#7fff7f}
  #lobby-screen .lobby-waiting{font-size:15px;color:rgba(255,255,255,0.4);letter-spacing:1px;text-align:center;line-height:1.8}
  #lobby-screen .lobby-players{display:flex;flex-direction:column;gap:10px;width:100%;max-width:280px}
  .lobby-player-row{
    display:flex;align-items:center;justify-content:space-between;
    background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);
    border-radius:12px;padding:12px 16px;
  }
  .lobby-player-name{font-size:15px;color:rgba(255,255,255,0.85)}
  .lobby-player-dist{font-size:11px;color:rgba(255,220,80,0.7)}
  .lobby-player-ready{font-size:13px;color:#7fff7f}
  #ready-btn{
    background:linear-gradient(135deg,#1a5c1a,#2a7c2a);
    border:0.5px solid #7fff7f;border-radius:14px;
    padding:16px 40px;color:#7fff7f;font-size:18px;
    cursor:pointer;letter-spacing:2px;font-weight:600;
    display:none;animation:readyPulse 1.5s ease-in-out infinite;
  }
  @keyframes readyPulse{0%,100%{box-shadow:0 0 0 0 rgba(127,255,127,0.4)}50%{box-shadow:0 0 0 12px rgba(127,255,127,0)}}
  #ready-btn.clicked{background:rgba(127,255,127,0.15);animation:none;color:rgba(127,255,127,0.6);cursor:default}

  /* ── COUNTDOWN ── */
  #countdown-screen{
    position:absolute;inset:0;z-index:90;
    display:none;flex-direction:column;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);
  }
  #countdown-number{
    font-size:160px;font-weight:900;
    color:#7fff7f;
    text-shadow:0 0 60px rgba(127,255,127,0.8),0 0 120px rgba(127,255,127,0.4);
    line-height:1;animation:cdPop 0.4s cubic-bezier(0.34,1.56,0.64,1);
    font-variant-numeric:tabular-nums;
  }
  #countdown-number.go{color:#fff;font-size:120px;text-shadow:0 0 60px rgba(255,255,255,0.9)}
  @keyframes cdPop{from{transform:scale(0.3);opacity:0}to{transform:scale(1);opacity:1}}
  #countdown-sub{font-size:16px;color:rgba(255,255,255,0.4);letter-spacing:3px;margin-top:16px}

  /* ── TIMER ── */
  #timer-wrap{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:36;display:none;pointer-events:none}
  #timer-number{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:800;color:#fff;text-shadow:0 0 20px rgba(255,80,80,0.9),0 0 40px rgba(255,80,80,0.5);font-variant-numeric:tabular-nums}

  /* ── DISQUALIF ── */
  #disqualif{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;z-index:100;background:rgba(0,0,0,0.78);backdrop-filter:blur(8px)}
  #disqualif .dq-emoji{font-size:72px;animation:dqBounce 0.5s ease-out}
  #disqualif .dq-title{font-size:42px;font-weight:900;letter-spacing:3px;color:#ff3333;text-shadow:0 0 30px rgba(255,50,50,0.9);animation:dqShake 0.4s ease-out 0.1s;margin:12px 0 8px}
  #disqualif .dq-sub{font-size:18px;color:rgba(255,255,255,0.6);letter-spacing:2px}
  #disqualif .dq-btn{margin-top:32px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);border-radius:30px;padding:12px 32px;color:rgba(255,255,255,0.8);font-size:15px;cursor:pointer;letter-spacing:1px}
  @keyframes dqBounce{0%{transform:scale(0) rotate(-20deg)}70%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1) rotate(0)}}
  @keyframes dqShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-10px)}75%{transform:translateX(10px)}}

  /* ── BALLE ── */
  #ball{position:absolute;width:56px;height:56px;border-radius:50%;display:none;z-index:50;cursor:grab;font-size:44px;line-height:56px;text-align:center;user-select:none;filter:drop-shadow(0 0 12px rgba(255,255,255,0.35))}
  #ball.held{cursor:grabbing;filter:drop-shadow(0 0 28px rgba(255,255,128,1))}

  /* ── JOUEURS ── */
  .player-dot-wrap{position:absolute;display:flex;flex-direction:column;align-items:center;gap:4px;z-index:45;transform:translate(-50%,-50%);cursor:pointer}
  .player-dot{width:18px;height:18px;border-radius:50%;background:#4fc3f7;border:2px solid rgba(255,255,255,0.6);box-shadow:0 0 10px rgba(79,195,247,0.6);animation:pB 2.5s ease-in-out infinite}
  .player-dot.sim{background:#ff9f4a;box-shadow:0 0 10px rgba(255,159,74,0.6)}
  .player-label{background:rgba(0,0,0,0.72);border-radius:12px;padding:4px 10px;font-size:12px;color:rgba(255,255,255,0.92);white-space:nowrap;border:0.5px solid rgba(255,255,255,0.12);text-align:center;line-height:1.6}
  .player-dist{font-size:10px;color:rgba(255,220,80,0.85);display:block}
  /* Surbrillance joueur avec balle */
  .player-dot.holder{
    background:#ffdd00 !important;
    box-shadow:0 0 0 3px rgba(255,220,0,0.6),0 0 20px rgba(255,220,0,0.9) !important;
    width:24px !important;height:24px !important;
    animation:holderPulse 0.8s ease-in-out infinite !important;
  }
  @keyframes holderPulse{0%,100%{box-shadow:0 0 0 3px rgba(255,220,0,0.6),0 0 20px rgba(255,220,0,0.8)}50%{box-shadow:0 0 0 8px rgba(255,220,0,0.2),0 0 35px rgba(255,220,0,1)}}
  .holder-label{
    background:rgba(255,200,0,0.2) !important;
    border-color:rgba(255,220,0,0.5) !important;
    color:#ffdd00 !important;
    font-weight:600;
  }
  /* Moi-même en surbrillance si j'ai la balle */
  #me-holder{
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:80px;height:80px;border-radius:50%;
    border:3px solid rgba(255,220,0,0.7);
    box-shadow:0 0 30px rgba(255,220,0,0.5),inset 0 0 30px rgba(255,220,0,0.1);
    z-index:22;pointer-events:none;display:none;
    animation:meHolderPulse 1s ease-in-out infinite;
  }
  @keyframes meHolderPulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.7}50%{transform:translate(-50%,-50%) scale(1.1);opacity:1}}
  @keyframes pB{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.3);opacity:1}}

  /* ── STATUS ── */
  #status-bar{position:absolute;bottom:env(safe-area-inset-bottom,0px);left:0;right:0;text-align:center;font-size:14px;color:rgba(255,255,255,0.5);z-index:40;padding:20px 20px 28px;background:linear-gradient(to top,rgba(0,0,0,0.4),transparent)}
  .throw-hint{position:absolute;top:50%;left:50%;transform:translate(-50%,calc(-50% + 52px));color:rgba(255,255,255,0.22);font-size:11px;z-index:36;pointer-events:none;text-align:center;display:none;letter-spacing:1.5px}
</style>

<div id="game">
  <canvas id="field-canvas"></canvas>
  <canvas id="overlay-canvas"></canvas>

  <div id="hud">
    <div class="badge" id="pseudo-badge">—</div>
    <div class="badge" id="players-badge">0 joueur</div>
    <div class="badge" id="sim-badge">🤖 SIMULATION</div>
  </div>

  <!-- LOBBY -->
  <div id="lobby-screen">
    <div class="lobby-title">⚽ THE BALL</div>
    <div class="lobby-waiting" id="lobby-msg">En attente d'un autre joueur…</div>
    <div class="lobby-players" id="lobby-players"></div>
    <button id="ready-btn">PRÊT À JOUER !</button>
  </div>

  <!-- COMPTE À REBOURS -->
  <div id="countdown-screen">
    <div id="countdown-number">5</div>
    <div id="countdown-sub">GET READY</div>
  </div>

  <!-- TIMER jeu -->
  <div id="timer-wrap">
    <svg width="140" height="140" viewBox="0 0 140 140" style="display:block">
      <circle cx="70" cy="70" r="62" fill="rgba(0,0,0,0.5)" stroke="rgba(255,68,68,0.15)" stroke-width="6"/>
      <circle id="timer-arc" cx="70" cy="70" r="62" fill="none" stroke="#ff4444" stroke-width="6"
        stroke-linecap="round" stroke-dasharray="389.6" stroke-dashoffset="0" transform="rotate(-90 70 70)"/>
    </svg>
    <div id="timer-number">3</div>
  </div>

  <!-- DISQUALIF -->
  <div id="disqualif">
    <div class="dq-emoji">😵</div>
    <div class="dq-title">DISQUALIFIÉ !</div>
    <div class="dq-sub">T'AS PAS ÉTÉ ASSEZ RAPIDE</div>
    <button class="dq-btn" id="dq-retry">↩ REVENIR AU JEU</button>
  </div>

  <div id="me-holder"></div>
  <div id="debug-log" style="position:absolute;bottom:80px;left:0;right:0;z-index:999;padding:8px 16px;font-size:10px;color:rgba(0,255,0,0.7);font-family:monospace;text-align:center;pointer-events:none;max-height:80px;overflow:hidden"></div>
  <div id="ball">⚽</div>
  <div class="throw-hint" id="throw-hint">GLISSE VERS UN JOUEUR</div>
  <div id="status-bar">Connexion…</div>
</div>
`
}

/* ══ INIT ══ */
export function initGame(sb, myUser, myPseudo, simulationMode=false) {
  const myId = myUser?.id || ('guest-'+Math.random().toString(36).substr(2,6))
  let myLat=null, myLng=null
  let players={}, hasBall=false, ballHeld=false
  let throwTimer=null, throwStart=null
  let playerScreenPositions={}
  let ballHolderId=null  // id du joueur qui a la balle (pour surbrillance)
  let iReady=false, gameStarted=false

  const game          = document.getElementById('game')
  const fieldCanvas   = document.getElementById('field-canvas')
  const overlayCanvas = document.getElementById('overlay-canvas')
  const ballEl        = document.getElementById('ball')
  const pseudoBadge   = document.getElementById('pseudo-badge')
  const playersBadge  = document.getElementById('players-badge')
  const timerWrap     = document.getElementById('timer-wrap')
  const timerArc      = document.getElementById('timer-arc')
  const timerNumber   = document.getElementById('timer-number')
  const statusEl      = document.getElementById('status-bar')
  const simBadge      = document.getElementById('sim-badge')
  const throwHint     = document.getElementById('throw-hint')
  const meHolder      = document.getElementById('me-holder')
  const disqualifEl   = document.getElementById('disqualif')
  const lobbyScreen   = document.getElementById('lobby-screen')
  const lobbyMsg      = document.getElementById('lobby-msg')
  const lobbyPlayers  = document.getElementById('lobby-players')
  const readyBtn      = document.getElementById('ready-btn')
  const cdScreen      = document.getElementById('countdown-screen')
  const cdNumber      = document.getElementById('countdown-number')
  const cdSub         = document.getElementById('countdown-sub')

  drawField(fieldCanvas)
  window.addEventListener('resize',()=>{drawField(fieldCanvas);renderPlayers()})
  pseudoBadge.textContent = myPseudo
  if(simulationMode) simBadge.style.display='block'
  document.addEventListener('pointerdown',()=>unlockAudio(),{once:true})

  function setStatus(msg){statusEl.textContent=msg}
  function dbg(msg){
    const el=document.getElementById('debug-log')
    if(!el)return
    const line=document.createElement('div')
    line.textContent=new Date().toISOString().substr(11,8)+' '+msg
    el.appendChild(line)
    if(el.children.length>4)el.removeChild(el.children[0])
  }

  /* ══ PHYSIQUE ══ */
  const physics = new BallPhysics(ballEl,
    ()=>{throwHint.style.display='block';setStatus('⚽ Attrape et lance !')},
    ()=>{ballEl.style.filter='drop-shadow(0 0 22px rgba(255,255,128,1))';setTimeout(()=>{ballEl.style.filter=''},120)}
  )

  /* ══ LOBBY ══ */
  function renderLobby() {
    const others = Object.values(players).filter(p=>p.id!==myId)
    const count = others.length

    if(count===0){
      lobbyMsg.textContent='En attente d\'un autre joueur…'
      readyBtn.style.display='none'
      lobbyPlayers.innerHTML=''
      return
    }

    lobbyMsg.textContent = count===1
      ? `${others[0].pseudo} est là ! Prêts à jouer ?`
      : `${count} joueurs présents ! Prêts à jouer ?`

    lobbyPlayers.innerHTML = others.map(p=>{
      const distM = myLat ? distanceMeters(myLat,myLng,p.latitude,p.longitude) : null
      const distLabel = distM===null?'':distM<1000?Math.round(distM)+' m':(distM/1000).toFixed(1)+' km'
      const readyMark = (p.ready) ? '<span class="lobby-player-ready">✓ Prêt</span>' : '<span style="color:rgba(255,255,255,0.25);font-size:13px">…</span>'
      return `<div class="lobby-player-row">
        <div>
          <div class="lobby-player-name">${p.pseudo}</div>
          ${distLabel?`<div class="lobby-player-dist">${distLabel}</div>`:''}
        </div>
        ${readyMark}
      </div>`
    }).join('')

    readyBtn.style.display = 'block'
    playersBadge.textContent = count+' joueur'+(count>1?'s':'')
  }

  readyBtn.addEventListener('click',async()=>{
    if(iReady)return
    iReady=true
    readyBtn.classList.add('clicked')
    readyBtn.textContent='✓ JE SUIS PRÊT !'
    // Marquer ma position comme ready
    await sb.from('ball_players').update({ready:true}).eq('id',myId)
    // Vérifier si tout le monde est prêt
    checkAllReady()
  })

  function checkAllReady(){
    const others=Object.values(players).filter(p=>p.id!==myId)
    if(others.length===0)return
    const allReady=iReady&&others.every(p=>p.ready)
    if(allReady) startCountdown()
  }

  /* ══ COMPTE À REBOURS 5→GO ══ */
  function startCountdown(){
    if(gameStarted)return
    gameStarted=true
    lobbyScreen.style.display='none'
    cdScreen.style.display='flex'
    let n=5
    cdNumber.textContent=n
    cdNumber.className=''
    cdSub.textContent='GET READY'

    const tick=()=>{
      cdNumber.className=''
      void cdNumber.offsetWidth  // reflow pour re-trigger animation
      cdNumber.className=''
      cdNumber.style.animation='none'
      requestAnimationFrame(()=>{
        cdNumber.style.animation=''
        cdNumber.classList.add(n===0?'go':'')
      })

      if(n===0){
        cdNumber.textContent='GO !'
        cdNumber.classList.add('go')
        cdSub.textContent=''
        setTimeout(()=>{
          cdScreen.style.display='none'
          assignBallRandomly()
        },900)
        return
      }
      cdNumber.textContent=n
      n--
      setTimeout(tick,1000)
    }
    tick()
  }

  /* ══ ATTRIBUTION BALLE AU HASARD ══ */
  async function assignBallRandomly(){
    const allPlayers=[myId,...Object.values(players).filter(p=>p.id!==myId).map(p=>p.id)]
    const idsorted=[...allPlayers].sort()
    const isLeader = idsorted[0]===myId

    dbg('assignBall isLeader='+isLeader+' players='+allPlayers.length)
    if(isLeader){
      const winner = allPlayers[Math.floor(Math.random()*allPlayers.length)]
      ballHolderId=winner
      renderPlayers()
      await updateBallState({status:'flying',holder_id:winner,from_id:'system',target_id:winner,updated_at:new Date().toISOString()})
      if(winner===myId){
        setTimeout(()=>receiveBall('system'),400)
      } else {
        setStatus('⏳ La balle part chez '+( Object.values(players).find(p=>p.id===winner)?.pseudo||'un joueur')+'...')
      }
    } else {
      // Non-leader : attend le realtime — mais si rien après 2s, relit le state
      setTimeout(async()=>{
        if(hasBall)return
        const{data:s}=await sb.from('ball_state').select('*').eq('id','current').single()
        if(!s)return
        ballHolderId=s.holder_id
        renderPlayers()
        if(s.holder_id===myId)receiveBall(s.from_id||'system')
        else setStatus('⏳ La balle est chez un autre joueur...')
      },2000)
    }
  }

  /* ══ JOUEURS SUR LE TERRAIN ══ */
  function renderPlayers(){
    document.querySelectorAll('.player-dot-wrap').forEach(e=>e.remove())
    playerScreenPositions={}
    if(!myLat||!gameStarted)return
    let count=0
    Object.values(players).forEach(p=>{
      if(p.id===myId||!p.latitude)return
      count++
      const distM=distanceMeters(myLat,myLng,p.latitude,p.longitude)
      const distLabel=distM<1000?Math.round(distM)+' m':(distM/1000).toFixed(1)+' km'
      const pos=getEdgePosition(bearingDeg(myLat,myLng,p.latitude,p.longitude))
      playerScreenPositions[p.id]={pos,player:p}
      const isHolder=p.id===ballHolderId
      const el=document.createElement('div')
      el.className='player-dot-wrap'+(isHolder?' has-ball':'')
      el.style.left=pos.x+'px';el.style.top=pos.y+'px'
      el.dataset.pid=p.id
      el.innerHTML=`
        <div class="player-dot${p.sim?' sim':''}${isHolder?' holder':''}"></div>
        <div class="player-label${isHolder?' holder-label':''}">
          ${isHolder?'⚽ ':''}${p.pseudo}
          <span class="player-dist">${distLabel}</span>
        </div>`
      game.appendChild(el)
    })
    playersBadge.textContent=count===0?'0 joueur':count===1?'1 joueur':count+' joueurs'
    if(hasBall)drawHalfCircles(overlayCanvas,playerScreenPositions)
    else{const ctx=overlayCanvas.getContext('2d');overlayCanvas.width=window.innerWidth;overlayCanvas.height=window.innerHeight;ctx.clearRect(0,0,window.innerWidth,window.innerHeight)}
  }

  function hideBall(){
    ballEl.style.display='none';physics.stop()
    hasBall=false;ballHeld=false;throwHint.style.display='none'
    meHolder.style.display='none'
    clearThrowTimer()
    const ctx=overlayCanvas.getContext('2d');overlayCanvas.width=window.innerWidth;overlayCanvas.height=window.innerHeight;ctx.clearRect(0,0,window.innerWidth,window.innerHeight)
    renderPlayers()
  }

  function receiveBall(fromId){
    dbg('receiveBall from='+fromId)
    hasBall=true
    ballHolderId=myId
    meHolder.style.display='block'
    playKickReceive()
    // Flash de repositionnement des joueurs
    document.querySelectorAll('.player-dot-wrap').forEach(el=>{
      el.style.transition='opacity 0.3s'
      el.style.opacity='0'
      setTimeout(()=>{el.style.opacity='1'},350)
    })
    const from=players[fromId]
    let sx,sy
    if(from&&myLat){const edge=getEdgePosition(bearingDeg(myLat,myLng,from.latitude,from.longitude));sx=edge.x;sy=edge.y}
    else{sx=window.innerWidth/2;sy=0}
    ballEl.style.display='block'
    physics.launch(sx,sy,window.innerWidth/2,window.innerHeight/2,16)
    setStatus(from?`⚽ Balle de ${from.pseudo} — attrape !`:'⚽ La balle est pour toi !')
    startThrowTimer()
    renderPlayers()
  }

  function startThrowTimer(){
    clearThrowTimer();throwStart=Date.now();timerWrap.style.display='block'
    const circ=389.6
    throwTimer=setInterval(()=>{
      const elapsed=Date.now()-throwStart,pct=Math.max(0,1-elapsed/THROW_TIME_LIMIT)
      const secs=Math.max(0,Math.ceil((THROW_TIME_LIMIT-elapsed)/1000))
      timerNumber.textContent=secs;timerArc.style.strokeDashoffset=String(circ*(1-pct))
      if(pct<0.5){timerArc.style.stroke='#ff6600';timerNumber.style.color='#ff6600'}
      if(pct<0.25){timerArc.style.stroke='#ff2222';timerNumber.style.color='#ff2222'}
      if(elapsed>=THROW_TIME_LIMIT){clearThrowTimer();disqualify()}
    },50)
  }

  function clearThrowTimer(){
    clearInterval(throwTimer);throwTimer=null;timerWrap.style.display='none'
    timerArc.style.strokeDashoffset='0';timerArc.style.stroke='#ff4444'
    timerNumber.textContent='10';timerNumber.style.color='#fff'
  }

  function disqualify(){
    hideBall();disqualifEl.style.display='flex'
    if(!simulationMode)updateBallState({status:'idle',holder_id:null,from_id:null,target_id:null})
  }

  document.getElementById('dq-retry').addEventListener('click',()=>{
    disqualifEl.style.display='none';setStatus('En attente de la balle...')
  })

  function throwBallToPlayer(targetPlayer){
    if(!hasBall)return
    const info=playerScreenPositions[targetPlayer.id];if(!info)return
    sendBallTo(targetPlayer,info.pos)
  }

  // Trouve le joueur le plus proche dans la direction du lancer
  function findTargetInDirection(vx,vy){
    // Direction normalisée du lancer
    const len=Math.sqrt(vx*vx+vy*vy)||1
    const nx=vx/len,ny=vy/len
    let best=null,bestScore=-1
    for(const[id,info]of Object.entries(playerScreenPositions)){
      const px=info.pos.x,py=info.pos.y
      // Vecteur balle → joueur
      const dx=px-physics.x,dy=py-physics.y
      const dlen=Math.sqrt(dx*dx+dy*dy)||1
      // Alignement (produit scalaire normalisé)
      const dot=(dx/dlen)*nx+(dy/dlen)*ny
      // Score = alignement (>0.5 = moins de 60° d écart)
      if(dot>0.5&&dot>bestScore){bestScore=dot;best=info.player}
    }
    return best
  }

  function sendBallTo(targetPlayer,tPos){
    ballHolderId=targetPlayer.id
    playKickLaunch();clearThrowTimer();throwHint.style.display='none'
    const ctx=overlayCanvas.getContext('2d');overlayCanvas.width=window.innerWidth;overlayCanvas.height=window.innerHeight;ctx.clearRect(0,0,window.innerWidth,window.innerHeight)
    const dx=tPos.x-physics.x,dy=tPos.y-physics.y,len=Math.sqrt(dx*dx+dy*dy)||1
    physics.throwFree(physics.x,physics.y,dx/len*22,dy/len*22)
    setTimeout(async()=>{
      // Repositionner les joueurs à chaque envoi réussi
      if(simulationMode) shufflePlayerPositions(players, myLat, myLng)
      hideBall();setStatus(`✅ Envoyée à ${targetPlayer.pseudo} !`)
      if(simulationMode)setTimeout(()=>receiveBall(targetPlayer.id),1800)
      else await updateBallState({status:'flying',holder_id:targetPlayer.id,from_id:myId,target_id:targetPlayer.id,updated_at:new Date().toISOString()})
    },500)
  }

  function bounceBack(){
    const sides=[{vx:-20,vy:(Math.random()-.5)*8},{vx:20,vy:(Math.random()-.5)*8},{vx:(Math.random()-.5)*8,vy:-20}]
    const s=sides[Math.floor(Math.random()*sides.length)]
    physics.friction=0.973;physics.maxBounces=4;physics.freeThrow=false
    physics.vx=s.vx;physics.vy=s.vy;physics.bounceCount=0
    physics.stopped=false;physics.running=true;physics._tick()
    setStatus('❌ Hors zone ! Rattrape la balle !');startThrowTimer()
  }

  /* ══ DRAG ══ */
  let dragOffX=0,dragOffY=0,dragVx=0,dragVy=0,lastDX=0,lastDY=0,lastDT=0
  ballEl.addEventListener('pointerdown',e=>{
    if(!hasBall)return
    physics.stop();ballHeld=true;ballEl.setPointerCapture(e.pointerId);ballEl.classList.add('held')
    throwHint.style.display='none'
    dragOffX=e.clientX-physics.x;dragOffY=e.clientY-physics.y
    lastDX=e.clientX;lastDY=e.clientY;lastDT=Date.now();dragVx=0;dragVy=0
    e.preventDefault()
  })
  ballEl.addEventListener('pointermove',e=>{
    if(!ballHeld)return
    const now=Date.now(),dt=Math.max(1,now-lastDT)
    dragVx=(e.clientX-lastDX)/dt*16;dragVy=(e.clientY-lastDY)/dt*16
    lastDX=e.clientX;lastDY=e.clientY;lastDT=now
    physics.setPos(e.clientX-dragOffX,e.clientY-dragOffY);e.preventDefault()
  })
  ballEl.addEventListener('pointerup',e=>{
    if(!ballHeld)return
    ballHeld=false;ballEl.classList.remove('held')
    const spd=Math.sqrt(dragVx*dragVx+dragVy*dragVy)

    if(spd>1.5){
      // On a un geste → cherche un joueur dans la direction du lancer
      const target=findTargetInDirection(dragVx,dragVy)
      if(target){
        physics.stopped=true
        sendBallTo(target,playerScreenPositions[target.id].pos)
        return
      }
      // Pas de joueur dans cette direction → rebond
      physics.friction=0.973;physics.maxBounces=3;physics.freeThrow=false
      physics.vx=dragVx;physics.vy=dragVy;physics.bounceCount=0
      physics.stopped=false;physics.running=true;physics._tick()
      setStatus('❌ Aucun joueur dans cette direction !')
    } else {
      // Pas de geste → balle posée, attente
      physics.stopped=true;throwHint.style.display='block'
      setStatus('⚽ Glisse vers un joueur !')
    }
  })

  /* ══ SUPABASE ══ */
  async function updateBallState(data){if(!sb)return;await sb.from('ball_state').update({...data,updated_at:new Date().toISOString()}).eq('id','current')}
  async function updatePosition(){
    if(!myId||simulationMode||!sb)return
    if(myLat===null)return  // pas encore de position
    const{error}=await sb.from('ball_players').upsert({
      id:myId,
      pseudo:myPseudo,
      latitude:myLat,
      longitude:myLng,
      last_seen:new Date().toISOString(),
      ready:iReady,
      user_id:myUser?.id||null
    })
    if(error)dbg('upsert ERR: '+error.message)
    else dbg('upsert OK lat='+myLat.toFixed(4))
  }

  function subscribeRealtime(){
    if(!sb||simulationMode)return
    sb.channel('ball-game-v7')
      .on('postgres_changes',{event:'*',schema:'public',table:'ball_players'},payload=>{
        if(payload.new?.id&&payload.new.id!==myId){players[payload.new.id]=payload.new;renderLobby();renderPlayers();checkAllReady()}
        if(payload.eventType==='DELETE'&&payload.old?.id){delete players[payload.old.id];renderLobby();renderPlayers()}
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'ball_state'},payload=>{
        const s=payload.new;if(!s)return
        dbg('ball_state: '+s.status+' holder='+( s.holder_id||'none').substr(0,6))
        if(s.status==='flying'){
          ballHolderId=s.holder_id
          renderPlayers()
          if(s.holder_id===myId&&!hasBall){
            receiveBall(s.from_id||'system')
          }
        }
        if(s.status==='flying'&&s.holder_id!==myId&&hasBall){hideBall();setStatus('⏳ Balle chez un autre joueur...')}
        if(s.status==='idle'&&hasBall){hideBall();setStatus('En attente de la balle...')}
      })
      .subscribe()
  }

  const getPos=()=>new Promise(resolve=>{
    if(!navigator.geolocation){
      dbg('no geolocation — using default')
      resolve({lat:43.2965,lng:5.3698});return
    }
    dbg('requesting GPS...')
    navigator.geolocation.getCurrentPosition(
      p=>{dbg('GPS OK '+p.coords.latitude.toFixed(4));resolve({lat:p.coords.latitude,lng:p.coords.longitude})},
      e=>{dbg('GPS fail: '+e.message+' — using default');resolve({lat:43.2965+(Math.random()-.5)*.0003,lng:5.3698+(Math.random()-.5)*.0003})},
      {timeout:8000,enableHighAccuracy:false}
    )
  })

  async function start(){
    const pos=await getPos();myLat=pos.lat;myLng=pos.lng

    if(simulationMode){
      getFakePlayers(myLat,myLng).forEach(p=>{players[p.id]=p})
      gameStarted=true;lobbyScreen.style.display='none'
      renderPlayers()
      setTimeout(()=>{receiveBall('sim-1');setStatus('⚽ Balle de Marco — attrape !')},700)
      return
    }

    dbg('start() myId='+myId.substr(0,6))
    await updatePosition()
    // Charge les joueurs déjà présents
    const since=new Date(Date.now()-30000).toISOString()
    const{data:others}=await sb.from('ball_players').select('*').gte('last_seen',since)
    if(others)others.forEach(p=>{if(p.id!==myId)players[p.id]=p})

    subscribeRealtime()
    setInterval(()=>updatePosition(),5000)
    dbg('realtime subscribed, players='+Object.keys(players).length)
    renderLobby()
    setStatus('Lobby — en attente des joueurs')
  }

  start()
  window.addEventListener('beforeunload',()=>{if(myId&&!simulationMode&&sb)sb.from('ball_players').delete().eq('id',myId)})
}
