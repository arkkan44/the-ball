export function renderAuth(onSuccess) {
  return `
  <style>
    #auth-screen {
      position: fixed; inset: 0;
      background: linear-gradient(160deg, #0a1a0a 0%, #0d2010 50%, #0a1a0a 100%);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 1000; font-family: system-ui, sans-serif;
      padding: 24px;
    }
    #auth-screen .logo { font-size: 52px; margin-bottom: 8px; }
    #auth-screen h1 { color: #7fff7f; font-size: 32px; font-weight: 300; letter-spacing: 6px; margin-bottom: 4px; }
    #auth-screen .tagline { color: rgba(255,255,255,0.35); font-size: 13px; letter-spacing: 2px; margin-bottom: 40px; }
    .auth-tabs { display: flex; gap: 0; margin-bottom: 28px; border: 0.5px solid rgba(255,255,255,0.15); border-radius: 10px; overflow: hidden; }
    .auth-tab { padding: 10px 28px; font-size: 14px; cursor: pointer; color: rgba(255,255,255,0.5); background: transparent; border: none; transition: all 0.2s; letter-spacing: 1px; }
    .auth-tab.active { background: rgba(127,255,127,0.12); color: #7fff7f; }
    .auth-form { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 320px; }
    .auth-input {
      background: rgba(255,255,255,0.07); border: 0.5px solid rgba(255,255,255,0.15);
      border-radius: 10px; padding: 14px 18px; color: white; font-size: 16px;
      outline: none; transition: border 0.2s; width: 100%;
    }
    .auth-input:focus { border-color: rgba(127,255,127,0.4); }
    .auth-input::placeholder { color: rgba(255,255,255,0.25); }
    .auth-btn {
      background: linear-gradient(135deg, #1a5c1a, #2a7c2a);
      border: 0.5px solid #7fff7f; border-radius: 10px;
      padding: 14px; color: #7fff7f; font-size: 15px;
      cursor: pointer; letter-spacing: 2px; font-weight: 500;
      margin-top: 4px; transition: all 0.2s;
    }
    .auth-btn:hover { background: linear-gradient(135deg, #2a7c2a, #3a9c3a); }
    .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .auth-msg { font-size: 13px; text-align: center; min-height: 18px; padding: 0 8px; }
    .auth-msg.error { color: #ff6b6b; }
    .auth-msg.success { color: #7fff7f; }
    .auth-msg.info { color: rgba(255,255,255,0.5); }
    .verify-box {
      text-align: center; padding: 24px; background: rgba(127,255,127,0.06);
      border: 0.5px solid rgba(127,255,127,0.2); border-radius: 14px;
      max-width: 320px; width: 100%;
    }
    .verify-box .icon { font-size: 48px; margin-bottom: 16px; }
    .verify-box h3 { color: #7fff7f; font-size: 18px; font-weight: 400; margin-bottom: 10px; }
    .verify-box p { color: rgba(255,255,255,0.5); font-size: 13px; line-height: 1.6; }
    .verify-box .resend-btn {
      margin-top: 20px; background: transparent; border: 0.5px solid rgba(255,255,255,0.2);
      border-radius: 8px; padding: 10px 20px; color: rgba(255,255,255,0.5);
      font-size: 13px; cursor: pointer;
    }
    #pseudo-field { display: none; }
  </style>

  <div id="auth-screen">
    <div class="logo">⚽</div>
    <h1>THE BALL</h1>
    <p class="tagline">LE JEU QUI VOUS RÉUNIT</p>

    <div class="auth-tabs" id="auth-tabs">
      <button class="auth-tab active" data-tab="login">CONNEXION</button>
      <button class="auth-tab" data-tab="register">INSCRIPTION</button>
    </div>

    <div class="auth-form" id="auth-form">
      <div id="pseudo-field">
        <input class="auth-input" id="auth-pseudo" type="text" placeholder="Ton pseudo (ex: Luc44)" maxlength="12" autocorrect="off"/>
      </div>
      <input class="auth-input" id="auth-email" type="email" placeholder="Email" autocomplete="email"/>
      <input class="auth-input" id="auth-password" type="password" placeholder="Mot de passe" autocomplete="current-password"/>
      <button class="auth-btn" id="auth-submit">CONNEXION</button>
      <div class="auth-msg info" id="auth-msg"></div>
    </div>

    <div class="verify-box" id="verify-box" style="display:none">
      <div class="icon">📬</div>
      <h3>Vérifie ta boîte mail !</h3>
      <p>On t'a envoyé un lien de confirmation.<br/>Clique dessus pour activer ton compte.</p>
      <button class="resend-btn" id="resend-btn">Renvoyer l'email</button>
    </div>
  </div>
  `
}

export function initAuth(sb, onSuccess) {
  let mode = 'login'

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mode = tab.dataset.tab
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      const pseudoField = document.getElementById('pseudo-field')
      const submitBtn = document.getElementById('auth-submit')
      const pwdInput = document.getElementById('auth-password')
      if (mode === 'register') {
        pseudoField.style.display = 'block'
        submitBtn.textContent = 'CRÉER MON COMPTE'
        pwdInput.placeholder = 'Mot de passe (min. 6 caractères)'
        pwdInput.autocomplete = 'new-password'
      } else {
        pseudoField.style.display = 'none'
        submitBtn.textContent = 'CONNEXION'
        pwdInput.placeholder = 'Mot de passe'
        pwdInput.autocomplete = 'current-password'
      }
      setMsg('', '')
    })
  })

  function setMsg(text, type = 'info') {
    const el = document.getElementById('auth-msg')
    el.textContent = text
    el.className = 'auth-msg ' + type
  }

  document.getElementById('auth-submit').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim()
    const password = document.getElementById('auth-password').value
    const btn = document.getElementById('auth-submit')

    if (!email || !password) { setMsg('Remplis tous les champs', 'error'); return }

    btn.disabled = true
    setMsg('Chargement...', 'info')

    if (mode === 'register') {
      const pseudo = document.getElementById('auth-pseudo').value.trim()
      if (!pseudo) { setMsg('Entre un pseudo', 'error'); btn.disabled = false; return }
      if (password.length < 6) { setMsg('Mot de passe trop court (min. 6)', 'error'); btn.disabled = false; return }

      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { pseudo } } })
      if (error) { setMsg(error.message, 'error'); btn.disabled = false; return }

      if (data.user && !data.session) {
        document.getElementById('auth-form').style.display = 'none'
        document.getElementById('auth-tabs').style.display = 'none'
        document.getElementById('verify-box').style.display = 'block'
      } else if (data.session) {
        await createProfile(sb, data.user, pseudo)
        onSuccess(data.user, pseudo)
      }
    } else {
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) { setMsg('Email ou mot de passe incorrect', 'error'); btn.disabled = false; return }
      const pseudo = data.user.user_metadata?.pseudo || data.user.email.split('@')[0]
      onSuccess(data.user, pseudo)
    }

    btn.disabled = false
  })

  document.getElementById('resend-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim()
    if (email) await sb.auth.resend({ type: 'signup', email })
    setMsg('Email renvoyé !', 'success')
  })

  ;['auth-email', 'auth-password', 'auth-pseudo'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('auth-submit').click()
    })
  })
}

async function createProfile(sb, user, pseudo) {
  await sb.from('profiles').upsert({ id: user.id, pseudo })
}
