import { AppLayout } from "@/components/layout/AppLayout";
import { SensorCard } from "@/components/dashboard/SensorCard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AlertPanel } from "@/components/dashboard/AlertPanel";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { MapView } from "@/components/map/MapView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Sprout,
  MapPin,
  Cpu,
  Activity
} from "lucide-react";
import heroImage from "@/assets/hero-agro.jpg";

const siteLocations = [
  { id: "SITE001", name: "Greenhouse Alpha", lat: -6.2615, lng: 106.7810, type: "Greenhouse", status: "operational" },
  { id: "SITE002", name: "Fish Pond Beta", lat: -6.5971, lng: 106.8060, type: "Aquaculture", status: "operational" },
  { id: "SITE003", name: "Livestock Farm Gamma", lat: -6.9175, lng: 107.6191, type: "Livestock", status: "maintenance" },
  { id: "SITE004", name: "Crop Field Delta", lat: -6.2382, lng: 106.9756, type: "Agriculture", status: "operational" }
];
  const productTitle = process.env.NEXT_PUBLIC_PRODUCT_TITLE;

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <div className="relative h-64 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/60" />
          <div className="relative h-full flex items-center px-8">
            <div className="text-primary-foreground space-y-2 animate-slide-up">
              <h1 className="text-4xl font-bold">{productTitle}</h1>
              <p className="text-lg opacity-90">Real-time IoT monitoring for smart agriculture</p>
              <div className="flex gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 animate-pulse-slow" />
                  <span className="text-sm">Live Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse-slow" />
                  <span className="text-sm">All Systems Operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatsCard
              title="Active Sites"
              value="12"
              icon={MapPin}
              description="3 Farms, 5 Greenhouses, 4 Ponds"
              gradient="bg-gradient-primary"
            />
            <StatsCard
              title="IoT Devices"
              value="48"
              icon={Cpu}
              description="42 Online, 6 Maintenance"
              gradient="bg-gradient-earth"
            />
            <StatsCard
              title="Sensors Active"
              value="156"
              icon={Activity}
              description="Real-time monitoring"
              gradient="bg-gradient-sky"
            />
          </div>

          {/* Sensor Monitoring */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SensorCard
              title="Temperature"
              value="28.5"
              unit="°C"
              icon={Thermometer}
              status="normal"
              lastUpdate="1 min ago"
              trend="stable"
            />
            <SensorCard
              title="Humidity"
              value="65"
              unit="%"
              icon={Droplets}
              status="normal"
              lastUpdate="2 min ago"
              trend="up"
            />
            <SensorCard
              title="Ammonia (NH₃)"
              value="18"
              unit="ppm"
              icon={Wind}
              status="warning"
              lastUpdate="30 sec ago"
              trend="up"
            />
            <SensorCard
              title="Soil pH"
              value="6.8"
              unit="pH"
              icon={Sprout}
              status="normal"
              lastUpdate="5 min ago"
              trend="stable"
            />
          </div>

          {/* Alerts, Site Locations, and Weather in one row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <AlertPanel />
            </div>
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Site Locations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <MapView locations={siteLocations} height="350px" />
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-1">
              <WeatherCard />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
