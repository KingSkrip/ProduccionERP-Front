export interface AppConfig {
  apiUrl: string;
  apiBase: string;
  appName: string;
  environment: 'dev' | 'prod';
  featureFlagX: boolean;

   tcpPort?: string;        // ← nuevo
  apiLanUrl?: string; 
  
  // reverb: {
  //   key: string;
  //   host: string;
  //   port: number;
  //   scheme: 'http' | 'https';
  // };
}
