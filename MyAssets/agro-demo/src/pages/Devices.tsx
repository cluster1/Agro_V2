import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cpu, Radio, Battery, Signal } from "lucide-react";

const devices = [
  {
    id: "DEV001",
    name: "Sensor Hub Alpha-1",
    type: "Multi-sensor",
    site: "Greenhouse Alpha",
    status: "online",
    battery: 95,
    signal: "strong",
    sensors: ["Temperature", "Humidity", "CO2"]
  },
  {
    id: "DEV002",
    name: "Water Monitor Beta-1",
    type: "pH Sensor",
    site: "Fish Pond Beta",
    status: "online",
    battery: 78,
    signal: "medium",
    sensors: ["pH", "Temperature", "Dissolved O2"]
  },
  {
    id: "DEV003",
    name: "Air Quality Gamma-1",
    type: "Gas Sensor",
    site: "Livestock Farm Gamma",
    status: "maintenance",
    battery: 45,
    signal: "weak",
    sensors: ["NH3", "CO2", "Temperature"]
  },
  {
    id: "DEV004",
    name: "Soil Monitor Delta-1",
    type: "Soil Sensor",
    site: "Crop Field Delta",
    status: "online",
    battery: 88,
    signal: "strong",
    sensors: ["pH", "Moisture", "NPK"]
  }
];

export default function Devices() {
  const [selectedSite, setSelectedSite] = useState<string>("all");

  const sites = ["all", ...Array.from(new Set(devices.map(d => d.site)))];
  const filteredDevices = selectedSite === "all" 
    ? devices 
    : devices.filter(d => d.site === selectedSite);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-success";
      case "offline":
        return "bg-destructive";
      case "maintenance":
        return "bg-warning";
      default:
        return "bg-muted";
    }
  };

  const getSignalIcon = (signal: string) => {
    const strength = signal === "strong" ? 3 : signal === "medium" ? 2 : 1;
    return (
      <div className="flex gap-0.5">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={`w-1 ${i < strength ? "bg-success" : "bg-muted"}`}
            style={{ height: `${(i + 1) * 4}px` }}
          />
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">IoT Devices</h1>
            <p className="text-muted-foreground">Monitor and manage all IoT devices and sensors</p>
          </div>
          <div className="w-64">
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites.filter(s => s !== "all").map((site) => (
                  <SelectItem key={site} value={site}>{site}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredDevices.map((device) => (
            <Card key={device.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-primary" />
                      {device.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{device.site}</p>
                  </div>
                  <Badge className={getStatusColor(device.status)}>
                    {device.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{device.type}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Battery className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Battery</p>
                      <p className="text-sm font-semibold">{device.battery}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Signal className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Signal</p>
                      <div className="pt-1">{getSignalIcon(device.signal)}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Active Sensors:</p>
                  <div className="flex flex-wrap gap-2">
                    {device.sensors.map((sensor) => (
                      <Badge key={sensor} variant="outline" className="text-xs">
                        <Radio className="h-3 w-3 mr-1" />
                        {sensor}
                      </Badge>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground pt-2">
                  Device ID: {device.id}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
