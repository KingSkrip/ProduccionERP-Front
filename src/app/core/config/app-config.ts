import { AppConfig } from './app-config.model';

export const APP_CONFIG: AppConfig = {
  //LOCAL
  // apiUrl: 'http://localhost:8000/api/',
  // apiBase: 'http://localhost:8000',
  // reverb: {
  //   key: 'skihewaszkyxb28di1za',
  //   host: 'localhost', // 👈 Cambia a localhost
  //   port: 8080,
  //   scheme: 'http',
  // },

  //SERVIDOR
  // apiUrl: 'https://fibrasan.ddns.net/api/public/api/',
  // apiBase: 'https://fibrasan.ddns.net/api/public',

  //TUNNEL
<<<<<<< Updated upstream
  // apiUrl: 'https://journalist-utilities-dans-beginning.trycloudflare.com/api/',
  // apiBase: 'https://journalist-utilities-dans-beginning.trycloudflare.com',
=======
  apiUrl: 'https://journalist-utilities-dans-beginning.trycloudflare.com/api/',
  apiBase: 'https://journalist-utilities-dans-beginning.trycloudflare.com',
>>>>>>> Stashed changes
  reverb: {
    key: 'skihewaszkyxb28di1za',
    // host: 'https://gamecube-ignored-either-led.trycloudflare.com',
    host: 'gamecube-ignored-either-led.trycloudflare.com',
    port: 443,
    scheme: 'https',
  },


  //OTROS
  appName: 'Fibrasan',
  environment: 'dev',
  featureFlagX: true,
};
