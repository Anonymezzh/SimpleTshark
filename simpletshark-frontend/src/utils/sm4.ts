import { SM4 } from 'gm-crypto';

class SM4Cipher {
  private readonly key;
  private readonly sm4;

  constructor(key: string) {
    this.key = SM4Cipher.toHexString(key);
    this.sm4 = SM4;
  }

  // 将传入的key转换为32位十六进制字符串
  private static toHexString(str: string): string {
    return Array.from(str)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
  }

  // 加密方法，返回Base64编码的字符串
  encrypt(data: string | object | number | boolean): string {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    return this.sm4.encrypt(dataStr, this.key, {
      inputEncoding: 'utf8',
      outputEncoding: 'base64'
    });
  }

  // 解密方法，返回字符串或对象
  decrypt(encryptedData: string): string | object {
    if (encryptedData === '') {
      return encryptedData;
    }
    const decryptedData = this.sm4.decrypt(encryptedData, this.key, {
      inputEncoding: 'base64',
      outputEncoding: 'utf8'
    });
    try {
      // 尝试解析为 JSON 对象，如果失败则返回原始字符串
      return JSON.parse(decryptedData);
    } catch {
      return decryptedData;
    }
  }
}

export default SM4Cipher;
