import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Droplets, Wind, Sun } from "lucide-react";

export function WeatherCard() {
  return (
    <Card className="bg-gradient-sky text-primary-foreground">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Weather Conditions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Current Temperature</p>
            <p className="text-4xl font-bold">28°C</p>
          </div>
          <Sun className="h-16 w-16 opacity-80" />
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-primary-foreground/20">
          <div className="flex flex-col items-center gap-1">
            <Droplets className="h-5 w-5 opacity-75" />
            <span className="text-xs opacity-75">Humidity</span>
            <span className="text-lg font-semibold">65%</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Wind className="h-5 w-5 opacity-75" />
            <span className="text-xs opacity-75">Wind</span>
            <span className="text-lg font-semibold">12 km/h</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Cloud className="h-5 w-5 opacity-75" />
            <span className="text-xs opacity-75">Clouds</span>
            <span className="text-lg font-semibold">40%</span>
          </div>
        </div>

        <p className="text-xs opacity-75 pt-2">
          Last updated: 5 minutes ago • BMKG API
        </p>
      </CardContent>
    </Card>
  );
}
