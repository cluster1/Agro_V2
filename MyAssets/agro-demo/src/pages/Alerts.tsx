import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, AlertTriangle, Info, Clock, MapPin } from "lucide-react";

const alerts = [
  {
    id: "ALR001",
    type: "critical" as const,
    title: "High ammonia level detected",
    description: "NH3 concentration exceeded threshold of 25 ppm",
    location: "Kandang A - Cluster 1",
    site: "Livestock Farm Gamma",
    timestamp: "2025-10-17T09:28:00Z",
    timeAgo: "2 min ago",
    value: "32 ppm"
  },
  {
    id: "ALR002",
    type: "warning" as const,
    title: "Temperature above threshold",
    description: "Temperature reading 35°C, optimal range is 25-30°C",
    location: "Greenhouse B - Sector 3",
    site: "Greenhouse Alpha",
    timestamp: "2025-10-17T09:15:00Z",
    timeAgo: "15 min ago",
    value: "35°C"
  },
  {
    id: "ALR003",
    type: "critical" as const,
    title: "Low oxygen level in pond",
    description: "Dissolved oxygen below critical level",
    location: "Kolam C - Zone 2",
    site: "Fish Pond Beta",
    timestamp: "2025-10-17T09:10:00Z",
    timeAgo: "20 min ago",
    value: "3.2 mg/L"
  },
  {
    id: "ALR004",
    type: "warning" as const,
    title: "High humidity detected",
    description: "Humidity level 85%, may affect crop health",
    location: "Section D4",
    site: "Greenhouse Alpha",
    timestamp: "2025-10-17T09:00:00Z",
    timeAgo: "30 min ago",
    value: "85%"
  },
  {
    id: "ALR005",
    type: "info" as const,
    title: "Sensor maintenance scheduled",
    description: "Routine maintenance for temperature sensor",
    location: "Device DEV003",
    site: "Livestock Farm Gamma",
    timestamp: "2025-10-17T08:30:00Z",
    timeAgo: "1 hour ago",
    value: "Scheduled"
  }
];

export default function Alerts() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredAlerts = selectedCategory === "all"
    ? alerts
    : alerts.filter(a => a.type === selectedCategory);

  const criticalCount = alerts.filter(a => a.type === "critical").length;
  const warningCount = alerts.filter(a => a.type === "warning").length;
  const infoCount = alerts.filter(a => a.type === "info").length;

  const getAlertIcon = (type: "critical" | "warning" | "info") => {
    switch (type) {
      case "critical":
        return <AlertCircle className="h-5 w-5" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5" />;
      case "info":
        return <Info className="h-5 w-5" />;
    }
  };

  const getAlertColor = (type: "critical" | "warning" | "info") => {
    switch (type) {
      case "critical":
        return "bg-destructive text-destructive-foreground";
      case "warning":
        return "bg-warning text-warning-foreground";
      case "info":
        return "bg-accent text-accent-foreground";
    }
  };

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">System Alerts</h1>
            <p className="text-muted-foreground">Monitor and manage all system notifications</p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-destructive/10">
                {criticalCount} Critical
              </Badge>
              <Badge variant="outline" className="bg-warning/10">
                {warningCount} Warnings
              </Badge>
              <Badge variant="outline" className="bg-accent/10">
                {infoCount} Info
              </Badge>
            </div>
            <div className="w-48">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card key={alert.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className={`p-3 rounded-lg ${getAlertColor(alert.type)} self-start`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{alert.title}</h3>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                      </div>
                      <Badge className={`${getAlertColor(alert.type)} capitalize`}>
                        {alert.type}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{alert.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{alert.timeAgo}</span>
                      </div>
                      <div>
                        <span className="font-medium">Value: </span>
                        <span>{alert.value}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Site: {alert.site} • Alert ID: {alert.id}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
