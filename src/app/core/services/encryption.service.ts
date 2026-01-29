// app/core/services/encryption.service.ts
import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';

@Injectable({ providedIn: 'root' })
export class EncryptionService {
  // 🔥 Tu APP_KEY del .env
  private readonly APP_KEY = 'base64:Yrpzgz9Owkt+RwePjA1t5PzrYJKNd47IJcjl1MQxENs=';

  constructor() {}

  /**
   * Desencriptar string encriptado por Laravel Crypt
   */
  decrypt(encryptedData: string): any {
    try {

      // 🔥 Laravel Crypt retorna base64(json({iv, value, mac, tag}))
      const decoded = atob(encryptedData);
      const payload = JSON.parse(decoded);


      // Extraer IV y valor encriptado
      const iv = CryptoJS.enc.Base64.parse(payload.iv);
      const encryptedValue = payload.value;

      // Obtener la clave sin el prefijo "base64:"
      const keyBase64 = this.APP_KEY.replace('base64:', '');
      const key = CryptoJS.enc.Base64.parse(keyBase64);

      // Desencriptar usando AES-256-CBC (como Laravel)
      const decrypted = CryptoJS.AES.decrypt(encryptedValue, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      // Convertir a string
      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);

      if (!decryptedStr) {
        throw new Error('La desencriptación resultó en una cadena vacía');
      }

      // Parsear el JSON original
      const result = JSON.parse(decryptedStr);
      return result;
    } catch (error) {
      console.error('❌ Error al desencriptar:', error);
      console.error('❌ Datos recibidos:', encryptedData.substring(0, 100));
      throw new Error('No se pudo desencriptar la respuesta: ' + error.message);
    }
  }

  /**
   * Verificar si la respuesta está encriptada
   */
  isEncrypted(data: any): boolean {
    const isEnc = data && data.encrypted === true && typeof data.data === 'string';
    return isEnc;
  }
}
