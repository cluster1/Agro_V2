import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly cache = new Map<string, { expires: number; data: unknown }>();

  constructor(private readonly config: ConfigService) {}

  async getCurrent(lat: number, lon: number): Promise<unknown> {
    const apiKey = this.config.get<string>('OPENWEATHER_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Weather not configured');
    }

    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.expires > now) return hit.data;

    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` +
      `&units=metric&appid=${encodeURIComponent(apiKey)}`;

    let data: unknown;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        this.logger.warn(`OpenWeather upstream returned status ${res.status}`);
        throw new BadGatewayException('Weather provider error');
      }
      data = await res.json();
    } catch (err) {
      if (err instanceof BadGatewayException) throw err;
      // Log only the error name; messages may embed the request URL (and key).
      this.logger.warn(`OpenWeather request failed: ${(err as Error)?.name}`);
      throw new BadGatewayException('Weather provider unavailable');
    }

    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      for (const [k, v] of this.cache) if (v.expires <= now) this.cache.delete(k);
      if (this.cache.size >= MAX_CACHE_ENTRIES) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) this.cache.delete(oldest);
      }
    }
    this.cache.set(key, { expires: now + TTL_MS, data });
    return data;
  }
}
