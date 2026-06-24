import { createClient } from '@supabase/supabase-js'
import { renderAuth, initAuth } from './screens/auth.js'
import { renderTutorial, initTutorial } from './screens/tutorial.js'
import { renderGame, initGame } from './screens/game.js'

const SUPABASE_URL = 'https://mcyhveqbviptpaswadop.supabase.co'
const SUPABASE_KEY = 'sb_publishable_1ZfodYSFYMip8akB3_xmBw_uqCqND9r'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
const app = document.getElementById('app')

async function bootstrap() {
  // Vérifier session existante
  const { data: { session } } = await sb.auth.getSession()

  if (session) {
    const pseudo = session.user.user_metadata?.pseudo || session.user.email.split('@')[0]
    showTutorial(session.user, pseudo)
  } else {
    showAuth()
  }
}

function showAuth() {
  app.innerHTML = renderAuth()
  initAuth(sb, (user, pseudo) => {
    showTutorial(user, pseudo)
  })
}

function showTutorial(user, pseudo) {
  app.innerHTML = renderTutorial(pseudo)
  initTutorial(
    () => showGame(user, pseudo, false),
    () => showGame(user, pseudo, true)
  )
}

function showGame(user, pseudo, simulationMode) {
  app.innerHTML = renderGame()
  initGame(sb, user, pseudo, simulationMode)
}

bootstrap()
