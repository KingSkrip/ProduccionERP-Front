export interface AppConfig {
  apiUrl: string;
  apiBase: string;
  appName: string;
  environment: 'dev' | 'prod';
  featureFlagX: boolean;
}
