// Sons générés via Web Audio API — aucun fichier externe nécessaire

let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

// Son coup de pied — réception de balle
export function playKickReceive() {
  try {
    const ac = getCtx()
    const now = ac.currentTime

    // Bruit sourd d'impact (kick)
    const buf = ac.createBuffer(1, ac.sampleRate * 0.12, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5)
    }
    const src = ac.createBufferSource()
    src.buffer = buf

    // Filtre passe-bas pour effet sourd
    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(300, now)
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.1)

    // Gain
    const gain = ac.createGain()
    gain.gain.setValueAtTime(1.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    // Tone de frappe grave
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, now)
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08)
    const oscGain = ac.createGain()
    oscGain.gain.setValueAtTime(0.7, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

    src.connect(filter); filter.connect(gain); gain.connect(ac.destination)
    osc.connect(oscGain); oscGain.connect(ac.destination)
    src.start(now); src.stop(now + 0.12)
    osc.start(now); osc.stop(now + 0.1)
  } catch(e) {}
}

// Son coup de pied — relance de balle
export function playKickLaunch() {
  try {
    const ac = getCtx()
    const now = ac.currentTime

    // Impact sec + sifflement
    const buf = ac.createBuffer(1, ac.sampleRate * 0.08, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
    }
    const src = ac.createBufferSource()
    src.buffer = buf

    const filter = ac.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(500, now)
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.07)

    const gain = ac.createGain()
    gain.gain.setValueAtTime(1.5, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    // Ton aigu de départ rapide
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.06)
    const oscGain = ac.createGain()
    oscGain.gain.setValueAtTime(0.9, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)

    // Sifflement de balle qui part (haute fréquence qui descend)
    const whistle = ac.createOscillator()
    whistle.type = 'sine'
    whistle.frequency.setValueAtTime(800, now + 0.03)
    whistle.frequency.exponentialRampToValueAtTime(200, now + 0.25)
    const wGain = ac.createGain()
    wGain.gain.setValueAtTime(0, now)
    wGain.gain.setValueAtTime(0.15, now + 0.03)
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    src.connect(filter); filter.connect(gain); gain.connect(ac.destination)
    osc.connect(oscGain); oscGain.connect(ac.destination)
    whistle.connect(wGain); wGain.connect(ac.destination)
    src.start(now); src.stop(now + 0.08)
    osc.start(now); osc.stop(now + 0.07)
    whistle.start(now + 0.03); whistle.stop(now + 0.25)
  } catch(e) {}
}

// Débloquer l'AudioContext sur premier touch (iOS)
export function unlockAudio() {
  try {
    const ac = getCtx()
    if (ac.state === 'suspended') ac.resume()
    // Bip silencieux pour débloquer
    const osc = ac.createOscillator()
    const g = ac.createGain(); g.gain.value = 0
    osc.connect(g); g.connect(ac.destination)
    osc.start(); osc.stop(ac.currentTime + 0.001)
  } catch(e) {}
}
