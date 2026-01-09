export const LANG_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
]

const EN = {
  'app.title': 'Body Recomposition Tracker',
  'app.by': 'Created by Andre Gomes',

  'nav.dashboard': 'Dashboard',
  'nav.entry': 'Entry',
  'nav.profile': 'Profile',
  'nav.admin': 'Admin',
  'nav.login': 'Log in',
  'nav.signup': 'Sign up',
  'nav.logout': 'Log out',
  'nav.notifications': 'Notifications',

  'profile.title': 'Profile & Settings',
  'profile.sex.label': 'Sex (required for Navy BF%)',
  'profile.sex.select': 'Select…',
  'profile.sex.male': 'Male',
  'profile.sex.female': 'Female',
  'profile.height': 'Height (cm)',
  'profile.triple': 'Triple measurements mode',
  'profile.triple.off': 'Off (single value per site)',
  'profile.triple.on': 'On (up to 3 readings per site)',
  'profile.language': 'Language',
  'profile.lift1': 'Lift 1 name',
  'profile.lift2': 'Lift 2 name',
  'profile.lift3': 'Lift 3 name',
  'profile.save': 'Save profile',
  'profile.saving': 'Saving…',
  'profile.export': 'Export CSV',
  'profile.saved': 'Profile saved.',
  'profile.error.save': 'Failed to save profile.',

  'auth.login.title': 'Log in',
  'auth.signup.title': 'Sign up',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.password.confirm': 'Confirm password',
  'auth.logging': 'Logging in…',
  'auth.creating': 'Creating…',
  'auth.sending': 'Sending…',
  'auth.signup.next': 'You’ll set sex + height next.',
  'auth.password.mismatch': 'Passwords do not match.',
  'auth.signup.cta': 'Sign up',
  'auth.reset': 'Forgot password?',
  'auth.reset.title': 'Reset password',
  'auth.reset.send': 'Send reset email',
  'auth.reset.sent': 'Password reset email sent.',
  'auth.back.login': 'Back to login',

  'entry.title': 'Entry',
  'dashboard.title': 'Dashboard',

  'notifications.title': 'Notifications',
  'notifications.empty': 'No notifications yet.',
  'notifications.back': 'Back to dashboard',

  'admin.denied.title': 'Not an Administrator',
  'admin.denied.text': 'Sorry, but you are not an Administrator.',
  'admin.denied.back': 'Back to dashboard',
}

const PT = {
  'app.title': 'Body Recomposition Tracker',
  'app.by': 'Criado por Andre Gomes',

  'nav.dashboard': 'Dashboard',
  'nav.entry': 'Registros',
  'nav.profile': 'Perfil',
  'nav.admin': 'Admin',
  'nav.login': 'Entrar',
  'nav.signup': 'Criar conta',
  'nav.logout': 'Sair',
  'nav.notifications': 'Notificações',

  'profile.title': 'Perfil e Configurações',
  'profile.sex.label': 'Sexo (necessário para %Gordura Navy)',
  'profile.sex.select': 'Selecione…',
  'profile.sex.male': 'Masculino',
  'profile.sex.female': 'Feminino',
  'profile.height': 'Altura (cm)',
  'profile.triple': 'Modo de 3 medições',
  'profile.triple.off': 'Desligado (um valor por medida)',
  'profile.triple.on': 'Ligado (até 3 leituras por medida)',
  'profile.language': 'Idioma',
  'profile.lift1': 'Nome do exercício 1',
  'profile.lift2': 'Nome do exercício 2',
  'profile.lift3': 'Nome do exercício 3',
  'profile.save': 'Salvar perfil',
  'profile.saving': 'Salvando…',
  'profile.export': 'Exportar CSV',
  'profile.saved': 'Perfil salvo.',
  'profile.error.save': 'Falha ao salvar o perfil.',

  'auth.login.title': 'Entrar',
  'auth.signup.title': 'Criar conta',
  'auth.email': 'Email',
  'auth.password': 'Senha',
  'auth.password.confirm': 'Confirmar senha',
  'auth.logging': 'Entrando…',
  'auth.creating': 'Criando…',
  'auth.sending': 'Enviando…',
  'auth.signup.next': 'Você vai definir sexo e altura em seguida.',
  'auth.password.mismatch': 'As senhas não conferem.',
  'auth.signup.cta': 'Criar conta',
  'auth.reset': 'Esqueci minha senha',
  'auth.reset.title': 'Redefinir senha',
  'auth.reset.send': 'Enviar email de redefinição',
  'auth.reset.sent': 'Email de redefinição enviado.',
  'auth.back.login': 'Voltar para entrar',

  'entry.title': 'Registros',
  'dashboard.title': 'Dashboard',

  'notifications.title': 'Notificações',
  'notifications.empty': 'Nenhuma notificação ainda.',
  'notifications.back': 'Voltar ao dashboard',

  'admin.denied.title': 'Sem permissão',
  'admin.denied.text': 'Desculpe, você não é Administrador(a).',
  'admin.denied.back': 'Voltar ao dashboard',
}

const DICTS = { 'en': EN, 'pt-BR': PT }

export function t(lang, key, vars) {
  const dict = DICTS[lang] || EN
  const base = dict[key] ?? EN[key] ?? key
  if (!vars) return base
  return String(base).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`))
}
