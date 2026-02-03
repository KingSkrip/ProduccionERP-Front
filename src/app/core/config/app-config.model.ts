export interface AppConfig {
  apiUrl: string;
  apiBase: string;
  appName: string;
  environment: 'dev' | 'prod';
  featureFlagX: boolean;

  reverb: {
    key: string;
    host: string;
    port: number;
    scheme: 'http' | 'https';
  };
}
