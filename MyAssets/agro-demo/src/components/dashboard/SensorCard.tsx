import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SensorCardProps {
  title: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  status: "normal" | "warning" | "critical";
  lastUpdate: string;
  trend?: "up" | "down" | "stable";
}

export function SensorCard({
  title,
  value,
  unit,
  icon: Icon,
  status,
  lastUpdate,
  trend = "stable"
}: SensorCardProps) {
  const statusColors = {
    normal: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    critical: "bg-destructive text-destructive-foreground"
  };

  const statusLabels = {
    normal: "Normal",
    warning: "Warning",
    critical: "Critical"
  };

  return (
    <Card className="hover:shadow-lg transition-shadow animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{value}</span>
            <span className="text-muted-foreground">{unit}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <Badge className={cn("text-xs", statusColors[status])}>
              {statusLabels[status]}
            </Badge>
            <span className="text-xs text-muted-foreground">{lastUpdate}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
