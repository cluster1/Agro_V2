import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  gradient?: string;
}

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  gradient = "bg-gradient-primary"
}: StatsCardProps) {
  return (
    <Card className={`${gradient} text-primary-foreground overflow-hidden relative`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium opacity-90">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {description && (
              <p className="text-xs opacity-75">{description}</p>
            )}
          </div>
          <div className="p-3 rounded-full bg-primary-foreground/20">
            <Icon className="h-8 w-8" />
          </div>
        </div>
        <div className="absolute -bottom-6 -right-6 opacity-10">
          <Icon className="h-32 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}
