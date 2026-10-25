import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  message: string;
  location: string;
  time: string;
}

const mockAlerts: Alert[] = [
  {
    id: "1",
    type: "critical",
    message: "High ammonia level detected",
    location: "Kandang A - Cluster 1",
    time: "2 min ago"
  },
  {
    id: "2",
    type: "warning",
    message: "Temperature above threshold",
    location: "Greenhouse B - Sector 3",
    time: "15 min ago"
  },
  {
    id: "3",
    type: "info",
    message: "Sensor maintenance scheduled",
    location: "Kolam C - Zone 2",
    time: "1 hour ago"
  }
];

export function AlertPanel() {
  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "critical":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      case "info":
        return <Info className="h-4 w-4" />;
    }
  };

  const getAlertColor = (type: Alert["type"]) => {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Recent Alerts
          <Badge variant="secondary" className="ml-auto">
            {mockAlerts.length} Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {mockAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className={`p-2 rounded-lg ${getAlertColor(alert.type)}`}>
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-muted-foreground">{alert.location}</p>
                </div>
                <span className="text-xs text-muted-foreground">{alert.time}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
