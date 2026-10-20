import { Translations } from 'taxon-shared';

/**
 * Textos del front en español, inglés y portugués. Las claves se agrupan por
 * pantalla. Se registran en AppComponent; las librerías registran los suyos.
 */
export const APP_I18N: Translations = {
  es: {
    // Layout
    'app.title': 'Nicho Ecológico', 'app.subtitle': 'Plataforma de exploración de datos ecológicos',
    'app.account': 'Mi cuenta', 'app.account.sub': 'Perfil, seguridad y datos cargados',
    'app.login.sub': 'Inicia sesión para continuar', 'app.register.sub': 'Crea tu cuenta', 'app.forgot.sub': 'Recupera tu contraseña',
    'app.menu': 'Mostrar u ocultar menú', 'app.noSession': 'Sin sesión', 'app.login': 'Iniciar sesión', 'app.register': 'Registrarse',
    'app.language': 'Idioma',
    'nav.niche': 'Nicho Ecológico', 'nav.networks': 'Redes Ecológicas', 'nav.cases': 'Casos de Uso', 'nav.language': 'Idioma', 'nav.login': 'Iniciar sesión',
    // Stepper
    'step.target': 'Target', 'step.covars': 'Covariables', 'step.results': 'Resultados',
    'step.target.title': 'Configuración Target', 'step.target.desc': 'Selecciona la fuente de datos, el área de estudio y la especie objetivo.',
    'step.covars.title': 'Configuración Covariables', 'step.covars.desc': 'Elige las variables con las que se va a cruzar el grupo objetivo.',
    'step.results.title': 'Resultados', 'step.results.desc': 'Revisa el resumen y ejecuta el análisis para ver mapa, histogramas y tabla.',
  },
  en: {
    'app.title': 'Ecological Niche', 'app.subtitle': 'Ecological data exploration platform',
    'app.account': 'My account', 'app.account.sub': 'Profile, security and uploaded data',
    'app.login.sub': 'Sign in to continue', 'app.register.sub': 'Create your account', 'app.forgot.sub': 'Recover your password',
    'app.menu': 'Show or hide menu', 'app.noSession': 'Not signed in', 'app.login': 'Sign in', 'app.register': 'Sign up',
    'app.language': 'Language',
    'nav.niche': 'Ecological Niche', 'nav.networks': 'Ecological Networks', 'nav.cases': 'Use Cases', 'nav.language': 'Language', 'nav.login': 'Sign in',
    'step.target': 'Target', 'step.covars': 'Covariates', 'step.results': 'Results',
    'step.target.title': 'Target setup', 'step.target.desc': 'Choose the data source, the study area and the target species.',
    'step.covars.title': 'Covariates setup', 'step.covars.desc': 'Choose the variables to cross with the target group.',
    'step.results.title': 'Results', 'step.results.desc': 'Review the summary and run the analysis to see the map, histograms and table.',
  },
  pt: {
    'app.title': 'Nicho Ecológico', 'app.subtitle': 'Plataforma de exploração de dados ecológicos',
    'app.account': 'Minha conta', 'app.account.sub': 'Perfil, segurança e dados carregados',
    'app.login.sub': 'Entre para continuar', 'app.register.sub': 'Crie sua conta', 'app.forgot.sub': 'Recupere sua senha',
    'app.menu': 'Mostrar ou ocultar menu', 'app.noSession': 'Sem sessão', 'app.login': 'Entrar', 'app.register': 'Cadastrar-se',
    'app.language': 'Idioma',
    'nav.niche': 'Nicho Ecológico', 'nav.networks': 'Redes Ecológicas', 'nav.cases': 'Casos de Uso', 'nav.language': 'Idioma', 'nav.login': 'Entrar',
    'step.target': 'Alvo', 'step.covars': 'Covariáveis', 'step.results': 'Resultados',
    'step.target.title': 'Configuração do alvo', 'step.target.desc': 'Escolha a fonte de dados, a área de estudo e a espécie alvo.',
    'step.covars.title': 'Configuração das covariáveis', 'step.covars.desc': 'Escolha as variáveis que serão cruzadas com o grupo alvo.',
    'step.results.title': 'Resultados', 'step.results.desc': 'Revise o resumo e execute a análise para ver o mapa, os histogramas e a tabela.',
  },
};
