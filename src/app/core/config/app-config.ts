import { AppConfig } from './app-config.model';

export const APP_CONFIG: AppConfig = {

  //LOCAL
  apiUrl: 'http://localhost:8000/api/',
  apiBase:'http://localhost:8000',

  //SERVIDOR
  // apiUrl: 'https://fibrasan.ddns.net/api/public/api/',
  // apiBase: 'https://fibrasan.ddns.net/api/public',

  //TUNNEL
  // apiUrl: 'https://duplicate-appliances-commit-stage.trycloudflare.com/api/',
  // apiBase:'https://duplicate-appliances-commit-stage.trycloudflare.com',

  appName: 'Fibrasan',
  environment: 'dev',
  featureFlagX: true,
};
