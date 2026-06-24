export function renderTutorial(pseudo, onStart, onSimulate) {
  return `
  <style>
    #tuto-screen {
      position: fixed; inset: 0;
      background: linear-gradient(160deg, #0a1a0a 0%, #0d2010 60%, #0a1a0a 100%);
      display: flex; flex-direction: column; align-items: center;
      z-index: 900; font-family: system-ui, sans-serif;
      overflow-y: auto; padding: 40px 24px 32px;
    }
    #tuto-screen h2 { color: #7fff7f; font-size: 22px; font-weight: 300; letter-spacing: 4px; margin-bottom: 6px; }
    #tuto-screen .welcome { color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 36px; }
    .tuto-steps { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 340px; margin-bottom: 40px; }
    .tuto-step {
      display: flex; align-items: flex-start; gap: 16px;
      background: rgba(255,255,255,0.04); border: 0.5px solid rgba(255,255,255,0.1);
      border-radius: 14px; padding: 18px 16px;
    }
    .tuto-step .step-icon { font-size: 28px; flex-shrink: 0; margin-top: 2px; }
    .tuto-step .step-content h4 { color: rgba(255,255,255,0.9); font-size: 15px; font-weight: 500; margin-bottom: 5px; }
    .tuto-step .step-content p { color: rgba(255,255,255,0.45); font-size: 13px; line-height: 1.6; }
    .tuto-step .step-content .highlight { color: #7fff7f; font-weight: 500; }
    .tuto-visual {
      width: 100%; max-width: 340px; height: 180px; position: relative;
      background: #0d1f0d; border: 0.5px solid rgba(255,255,255,0.1);
      border-radius: 14px; margin-bottom: 40px; overflow: hidden;
    }
    .tuto-visual svg { width: 100%; height: 100%; }
    .mini-ball { animation: floatBall 2s ease-in-out infinite; }
    @keyframes floatBall { 0%,100%{transform:translate(0,0)} 50%{transform:translate(4px,-6px)} }
    .arrow-anim { animation: arrowPulse 1.5s ease-in-out infinite; }
    @keyframes arrowPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
    .tuto-btns { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 340px; }
    .tuto-btn-main {
      background: linear-gradient(135deg, #1a5c1a, #2a7c2a);
      border: 0.5px solid #7fff7f; border-radius: 12px;
      padding: 16px; color: #7fff7f; font-size: 16px;
      cursor: pointer; letter-spacing: 2px; font-weight: 500; text-align: center;
    }
    .tuto-btn-sim {
      background: rgba(255,255,255,0.05); border: 0.5px solid rgba(255,255,255,0.2);
      border-radius: 12px; padding: 14px; color: rgba(255,255,255,0.6);
      font-size: 14px; cursor: pointer; letter-spacing: 1px; text-align: center;
    }
    .tuto-btn-sim span { color: #4fc3f7; }
  </style>

  <div id="tuto-screen">
    <h2>⚽ THE BALL</h2>
    <p class="welcome">Bienvenue ${pseudo} !</p>

    <div class="tuto-visual">
      <svg viewBox="0 0 340 180" xmlns="http://www.w3.org/2000/svg">
        <rect width="340" height="180" fill="#0d1f0d"/>
        <rect x="10" y="10" width="320" height="160" rx="6" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
        <line x1="10" y1="90" x2="330" y2="90" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
        <circle cx="170" cy="90" r="35" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
        <!-- Toi au centre -->
        <circle cx="170" cy="90" r="8" fill="#7fff7f" opacity="0.9"/>
        <text x="170" y="108" text-anchor="middle" font-size="9" fill="rgba(127,255,127,0.7)">TOI</text>
        <!-- Joueurs sur les bords -->
        <circle cx="30" cy="90" r="6" fill="#4fc3f7" opacity="0.8"/>
        <text x="30" y="106" text-anchor="middle" font-size="8" fill="rgba(79,195,247,0.7)">Marc</text>
        <circle cx="310" cy="60" r="6" fill="#4fc3f7" opacity="0.8"/>
        <text x="310" y="76" text-anchor="middle" font-size="8" fill="rgba(79,195,247,0.7)">Sofia</text>
        <circle cx="170" cy="20" r="6" fill="#4fc3f7" opacity="0.8"/>
        <text x="170" y="36" text-anchor="middle" font-size="8" fill="rgba(79,195,247,0.7)">Karim</text>
        <!-- Balle animée -->
        <g class="mini-ball">
          <circle cx="170" cy="90" r="10" fill="radial-gradient(circle, #fff, #888)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
          <circle cx="170" cy="90" r="10" fill="white" opacity="0.9"/>
          <path d="M165 86 Q170 82 175 86 Q172 92 170 94 Q168 92 165 86Z" fill="rgba(0,0,0,0.15)"/>
        </g>
        <!-- Flèche animée vers Marc -->
        <line class="arrow-anim" x1="160" y1="90" x2="45" y2="90" stroke="#7fff7f" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arr)"/>
        <defs>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6Z" fill="#7fff7f"/>
          </marker>
        </defs>
      </svg>
    </div>

    <div class="tuto-steps">
      <div class="tuto-step">
        <div class="step-icon">📍</div>
        <div class="step-content">
          <h4>Sois proche des autres</h4>
          <p>Le jeu détecte automatiquement les joueurs dans un rayon de <span class="highlight">200 mètres</span> autour de toi.</p>
        </div>
      </div>
      <div class="tuto-step">
        <div class="step-icon">⚽</div>
        <div class="step-content">
          <h4>Reçois la balle</h4>
          <p>Elle apparaît au centre de ton écran. Les autres joueurs sont visibles sur les <span class="highlight">bords de l'écran</span> selon leur direction réelle.</p>
        </div>
      </div>
      <div class="tuto-step">
        <div class="step-icon">👆</div>
        <div class="step-content">
          <h4>Lance-la !</h4>
          <p>Fais glisser la balle vers le bord de l'écran dans la direction du joueur à qui tu veux l'envoyer. Tu as <span class="highlight">3 secondes</span> !</p>
        </div>
      </div>
      <div class="tuto-step">
        <div class="step-icon">⚡</div>
        <div class="step-content">
          <h4>Ne sois pas disqualifié</h4>
          <p>Si tu ne lances pas la balle à temps, tu es <span class="highlight">éliminé</span> de la partie. Sois rapide !</p>
        </div>
      </div>
    </div>

    <div class="tuto-btns">
      <button class="tuto-btn-main" id="tuto-start-btn">🚀 REJOINDRE UNE PARTIE</button>
      <button class="tuto-btn-sim" id="tuto-sim-btn">🤖 <span>MODE SIMULATION</span> — Tester avec 5 joueurs virtuels</button>
    </div>
  </div>
  `
}

export function initTutorial(onStart, onSimulate) {
  document.getElementById('tuto-start-btn').addEventListener('click', onStart)
  document.getElementById('tuto-sim-btn').addEventListener('click', onSimulate)
}
