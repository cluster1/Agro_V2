'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cloud, CloudRain, Sun, Wind, Droplets, CloudSnow, CloudDrizzle, CloudLightning, CloudFog, CloudSun, MapPin } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { api } from '@/lib/api'
import { formatNumber, formatDateTime } from '@/lib/format'

interface WeatherCardProps {
  latitude: number
  longitude: number
  siteName?: string
}

// BMKG Weather Data Interface
interface BMKGWeatherData {
  location: {
    lat: number
    lon: number
    province: string
    description: string
  }
  data: Array<{
    datetime: string
    t: number // temperature (deg C)
    hu: number // humidity (%)
    ws: number // wind speed, BMKG publishes km/jam (km/h)
    wd: string // wind direction
    weather_desc: string
    weather: string | number // BMKG weather code
    local_datetime: string
  }>
}

type IconKind = 'storm' | 'drizzle' | 'rain' | 'snow' | 'fog' | 'cloud' | 'partly' | 'sun'

interface WeatherView {
  source: 'BMKG' | 'OpenWeatherMap'
  temp: number
  feelsLike?: number
  humidity: number
  windSpeed: number
  windUnit: string
  description: string
  icon: IconKind
  placeName?: string
  province?: string
  forecastTime?: string
}

const ICONS: Record<IconKind, typeof Sun> = {
  storm: CloudLightning,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  fog: CloudFog,
  cloud: Cloud,
  partly: CloudSun,
  sun: Sun,
}

/** OpenWeatherMap condition id -> icon. */
function iconFromOwm(id: number): IconKind {
  if (id >= 200 && id < 300) return 'storm'
  if (id >= 300 && id < 400) return 'drizzle'
  if (id >= 500 && id < 600) return 'rain'
  if (id >= 600 && id < 700) return 'snow'
  if (id >= 700 && id < 800) return 'fog'
  if (id === 800) return 'sun'
  if (id === 801 || id === 802) return 'partly'
  return 'cloud'
}

/** BMKG weather code (0 cerah, 1-2 cerah berawan, 3-4 berawan, 5-45 kabut/asap, 60-63/80 hujan, 95-97 petir). */
function iconFromBmkg(code: string | number | undefined, description: string): IconKind {
  const n = typeof code === 'number' ? code : parseInt(String(code ?? ''), 10)
  if (!Number.isNaN(n)) {
    if (n === 0) return 'sun'
    if (n === 1 || n === 2) return 'partly'
    if (n === 3 || n === 4) return 'cloud'
    if (n === 5 || n === 10 || n === 45) return 'fog'
    if (n === 95 || n === 97) return 'storm'
    if (n >= 60 && n <= 63) return n === 60 ? 'drizzle' : 'rain'
    if (n === 80) return 'rain'
  }
  const d = description.toLowerCase()
  if (d.includes('petir')) return 'storm'
  if (d.includes('hujan')) return d.includes('ringan') ? 'drizzle' : 'rain'
  if (d.includes('kabut') || d.includes('asap') || d.includes('kabur')) return 'fog'
  if (d.includes('berawan')) return d.includes('cerah') ? 'partly' : 'cloud'
  if (d.includes('cerah')) return 'sun'
  return 'cloud'
}

async function fetchWeather(latitude: number, longitude: number, siteName?: string): Promise<WeatherView> {
  try {
    // BMKG first (free, no API key)
    const bmkgResponse = await fetch(
      `https://api.bmkg.go.id/publik/prakiraan-cuaca?lat=${latitude}&lon=${longitude}`
    )

    if (bmkgResponse.ok) {
      const bmkgData: BMKGWeatherData = await bmkgResponse.json()
      const entries = bmkgData.data ?? []
      if (entries.length > 0) {
        // Use the forecast slot closest to now rather than blindly the first one.
        const now = Date.now()
        const current = entries.reduce((best, e) => {
          const diff = Math.abs(new Date(e.datetime).getTime() - now)
          const bestDiff = Math.abs(new Date(best.datetime).getTime() - now)
          return Number.isNaN(diff) ? best : diff < bestDiff || Number.isNaN(bestDiff) ? e : best
        }, entries[0])

        return {
          source: 'BMKG',
          temp: current.t,
          humidity: current.hu,
          windSpeed: current.ws,
          windUnit: 'km/jam',
          description: current.weather_desc,
          icon: iconFromBmkg(current.weather, current.weather_desc ?? ''),
          placeName: bmkgData.location?.description || siteName,
          province: bmkgData.location?.province,
          forecastTime: current.local_datetime,
        }
      }
    }
  } catch {
    // fall through to the backend proxy
  }

  // Fallback: backend proxies OpenWeatherMap (the API key stays server-side).
  const response = await api.get('/weather/current', { params: { lat: latitude, lon: longitude } })
  const owm = response.data
  const first = owm.weather?.[0]
  return {
    source: 'OpenWeatherMap',
    temp: owm.main.temp,
    feelsLike: owm.main.feels_like,
    humidity: owm.main.humidity,
    windSpeed: owm.wind?.speed,
    windUnit: 'm/s',
    description: first?.description ?? '',
    icon: iconFromOwm(first?.id ?? 800),
    placeName: owm.name || siteName,
  }
}

function WeatherHeader({ source }: { source?: WeatherView['source'] }) {
  return (
    <CardHeader className="border-b bg-gradient-to-r from-info/5 to-transparent px-4 py-3">
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 text-info" aria-hidden="true" />
        <div>
          <CardTitle className="text-base">Prakiraan Cuaca</CardTitle>
          {source && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sumber: {source === 'BMKG' ? 'BMKG' : 'OpenWeatherMap'}
            </p>
          )}
        </div>
      </div>
    </CardHeader>
  )
}

export function WeatherCard({ latitude, longitude, siteName }: WeatherCardProps) {
  const { data: weather, isLoading, isError, refetch } = useQuery({
    queryKey: ['weather', latitude, longitude],
    queryFn: () => fetchWeather(latitude, longitude, siteName),
    refetchInterval: 600000, // Refresh every 10 minutes
    retry: 2,
  })

  if (isLoading) {
    return (
      <Card className="border-2 shadow-lg" role="status" aria-label="Memuat prakiraan cuaca">
        <WeatherHeader />
        <CardContent className="p-4">
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isError || !weather) {
    return (
      <Card className="border-2 shadow-lg">
        <WeatherHeader />
        <CardContent className="p-4">
          <ErrorState
            title="Prakiraan cuaca tidak tersedia"
            message="Data cuaca belum dapat dimuat saat ini. Silakan coba lagi beberapa saat lagi."
            onRetry={() => refetch()}
            className="p-4"
          />
        </CardContent>
      </Card>
    )
  }

  const Icon = ICONS[weather.icon]
  const hasWind = typeof weather.windSpeed === 'number' && !Number.isNaN(weather.windSpeed)

  return (
    <Card className="border-2 shadow-lg motion-safe:animate-slide-up">
      <WeatherHeader source={weather.source} />
      <CardContent className="p-4">
        <div className="space-y-3">
          {siteName && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {siteName}
            </p>
          )}

          {/* Main Weather Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
              <div>
                <div className="text-2xl font-bold tabular-nums">{formatNumber(Math.round(weather.temp))}°C</div>
                <p className="text-sm capitalize text-muted-foreground">{weather.description}</p>
              </div>
            </div>
            {weather.feelsLike !== undefined && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Terasa seperti</p>
                <p className="text-lg font-semibold tabular-nums">{formatNumber(Math.round(weather.feelsLike))}°C</p>
              </div>
            )}
          </div>

          {/* Weather Details Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
              <Droplets className="h-4 w-4 text-info" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Kelembapan</p>
                <p className="text-sm font-semibold tabular-nums">{formatNumber(weather.humidity)}%</p>
              </div>
            </div>

            {hasWind && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                <Wind className="h-4 w-4 text-success" aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground">Kecepatan Angin</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatNumber(weather.windSpeed)} {weather.windUnit}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Location / forecast info */}
          <div className="space-y-0.5 border-t pt-2 text-center">
            <p className="text-xs text-muted-foreground">
              {weather.placeName || 'Lokasi tidak diketahui'}
              {weather.province && ` • ${weather.province}`}
            </p>
            {weather.forecastTime && (
              <p className="text-xs text-muted-foreground">
                Prakiraan untuk {formatDateTime(weather.forecastTime)}
              </p>
            )}
            <p className="text-xs text-muted-foreground tabular-nums">
              Lat: {latitude.toFixed(4)}, Lon: {longitude.toFixed(4)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
