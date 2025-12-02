export interface AppConfig {
  apiUrl: string;
  appName: string;
  environment: 'dev' | 'prod';
  featureFlagX: boolean;
}
