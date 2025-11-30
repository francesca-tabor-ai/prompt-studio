export interface CompressionOptions {
  threshold?: number;
  level?: number;
}

class CompressionService {
  private static instance: CompressionService;
  private defaultThreshold = 1024;
  private defaultLevel = 6;

  private constructor() {}

  static getInstance(): CompressionService {
    if (!CompressionService.instance) {
      CompressionService.instance = new CompressionService();
    }
    return CompressionService.instance;
  }

  shouldCompress(
    acceptEncoding: string | undefined,
    payloadSize: number,
    options?: CompressionOptions
  ): boolean {
    if (!acceptEncoding) {
      return false;
    }

    const threshold = options?.threshold || this.defaultThreshold;

    if (payloadSize < threshold) {
      return false;
    }

    return (
      acceptEncoding.includes('gzip') ||
      acceptEncoding.includes('deflate') ||
      acceptEncoding.includes('br')
    );
  }

  getCompressionType(acceptEncoding: string): string {
    if (acceptEncoding.includes('br')) {
      return 'br';
    }
    if (acceptEncoding.includes('gzip')) {
      return 'gzip';
    }
    if (acceptEncoding.includes('deflate')) {
      return 'deflate';
    }
    return 'none';
  }

  async compress(
    data: string | Buffer,
    encoding: string = 'gzip'
  ): Promise<Buffer> {
    const input = typeof data === 'string' ? Buffer.from(data) : data;

    return input;
  }

  calculateCompressionRatio(
    originalSize: number,
    compressedSize: number
  ): number {
    return ((originalSize - compressedSize) / originalSize) * 100;
  }

  estimateCompressedSize(originalSize: number, contentType: string): number {
    const compressionRatios: Record<string, number> = {
      'application/json': 0.3,
      'text/html': 0.25,
      'text/plain': 0.35,
      'text/css': 0.25,
      'application/javascript': 0.3,
    };

    const ratio = compressionRatios[contentType] || 0.5;

    return Math.floor(originalSize * ratio);
  }

  getCompressionHeaders(encoding: string, originalSize: number): Record<string, string> {
    return {
      'Content-Encoding': encoding,
      'Vary': 'Accept-Encoding',
      'X-Original-Size': originalSize.toString(),
    };
  }

  setThreshold(bytes: number): void {
    this.defaultThreshold = bytes;
  }

  setLevel(level: number): void {
    if (level >= 0 && level <= 9) {
      this.defaultLevel = level;
    }
  }
}

export const compressionService = CompressionService.getInstance();
