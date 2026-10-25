import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cloud, CloudRain, Droplets, Wind, Sun, Eye, Gauge, Info } from "lucide-react";

const weatherData = [
  {
    site: "Greenhouse Alpha",
    region: "Jakarta Region",
    temp: 28,
    condition: "Partly Cloudy",
    icon: Sun,
    humidity: 65,
    windSpeed: 12,
    windDirection: "Southeast",
    rainfall: 2.5,
    pressure: 1013,
    visibility: 10,
    uvIndex: "7 (High)",
    cloudCover: 40,
    advisory: "Moderate rainfall expected in the next 6 hours. Consider adjusting irrigation schedules."
  },
  {
    site: "Fish Pond Beta",
    region: "Tangerang Region",
    temp: 30,
    condition: "Sunny",
    icon: Sun,
    humidity: 58,
    windSpeed: 8,
    windDirection: "East",
    rainfall: 0,
    pressure: 1015,
    visibility: 12,
    uvIndex: "9 (Very High)",
    cloudCover: 15,
    advisory: "Clear weather conditions ideal for pond operations. Monitor water temperature closely."
  },
  {
    site: "Livestock Farm Gamma",
    region: "Bekasi Region",
    temp: 26,
    condition: "Cloudy",
    icon: Cloud,
    humidity: 72,
    windSpeed: 15,
    windDirection: "Southwest",
    rainfall: 5.2,
    pressure: 1010,
    visibility: 8,
    uvIndex: "4 (Moderate)",
    cloudCover: 75,
    advisory: "Heavy rainfall expected. Ensure proper ventilation in livestock facilities."
  },
  {
    site: "Crop Field Delta",
    region: "Bogor Region",
    temp: 25,
    condition: "Light Rain",
    icon: CloudRain,
    humidity: 80,
    windSpeed: 18,
    windDirection: "West",
    rainfall: 8.5,
    pressure: 1008,
    visibility: 6,
    uvIndex: "3 (Moderate)",
    cloudCover: 90,
    advisory: "Continuous rainfall may affect soil moisture. Consider delaying fertilizer application."
  }
];

export default function Weather() {
  const [selectedSite, setSelectedSite] = useState<string>(weatherData[0].site);
  const currentWeather = weatherData.find(w => w.site === selectedSite) || weatherData[0];
  const WeatherIcon = currentWeather.icon;
  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Weather Monitoring</h1>
            <p className="text-muted-foreground">Real-time weather data from BMKG API integration</p>
          </div>
          <div className="w-64">
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger>
                <SelectValue placeholder="Select site" />
              </SelectTrigger>
              <SelectContent>
                {weatherData.map((weather) => (
                  <SelectItem key={weather.site} value={weather.site}>
                    {weather.site}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Current Weather */}
        <Card className="bg-gradient-sky text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-2xl">Current Weather Conditions</CardTitle>
            <p className="text-sm opacity-90">{currentWeather.region} • Last updated: 5 minutes ago</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-6xl font-bold">{currentWeather.temp}°C</p>
                <p className="text-xl opacity-90 mt-2">{currentWeather.condition}</p>
              </div>
              <WeatherIcon className="h-32 w-32 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Weather Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-accent" />
                Humidity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{currentWeather.humidity}%</p>
              <p className="text-sm text-muted-foreground mt-2">Optimal range: 40-70%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wind className="h-5 w-5 text-primary" />
                Wind Speed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{currentWeather.windSpeed} km/h</p>
              <p className="text-sm text-muted-foreground mt-2">Direction: {currentWeather.windDirection}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudRain className="h-5 w-5 text-accent" />
                Rainfall
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{currentWeather.rainfall} mm</p>
              <p className="text-sm text-muted-foreground mt-2">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Gauge className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pressure</p>
                  <p className="text-xl font-bold">{currentWeather.pressure} hPa</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Eye className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Visibility</p>
                  <p className="text-xl font-bold">{currentWeather.visibility} km</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Sun className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">UV Index</p>
                  <p className="text-xl font-bold">{currentWeather.uvIndex}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Cloud className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cloud Cover</p>
                  <p className="text-xl font-bold">{currentWeather.cloudCover}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Forecast Note */}
        <Card className="border-l-4 border-l-accent">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-accent mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Weather Advisory</p>
                <p className="text-sm text-muted-foreground">
                  {currentWeather.advisory}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
