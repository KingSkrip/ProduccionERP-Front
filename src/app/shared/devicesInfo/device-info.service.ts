import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DeviceInfoService {
  async getDeviceInfo(): Promise<any> {
    const info: any = {
      user_agent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screen: `${screen.width}x${screen.height}`,
      brands: null,
      mobile: null,
      model: null,
      platform_version: null,
    };

    const uaData = (navigator as any).userAgentData;
    if (uaData) {
      info.brands = uaData.brands?.map((b: any) => b.brand).join(', ') ?? null;
      info.mobile = uaData.mobile ?? null;

      try {
        const hi = await uaData.getHighEntropyValues([
          'model',
          'platformVersion',
          'fullVersionList',
        ]);
        info.model = hi.model || null;
        info.platform_version = hi.platformVersion || null;
      } catch {
        // navegador no soporta high entropy values, no pasa nada
      }
    }

    return info;
  }
}