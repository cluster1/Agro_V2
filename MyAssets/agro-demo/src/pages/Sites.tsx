import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapView } from "@/components/map/MapView";
import { MapPin, Layers, Activity } from "lucide-react";

const sites = [
  {
    id: "SITE001",
    name: "Greenhouse Alpha",
    type: "Greenhouse",
    clusters: 3,
    devices: 12,
    status: "operational",
    location: "Jakarta Selatan",
    lat: -6.2615,
    lng: 106.7810
  },
  {
    id: "SITE002",
    name: "Fish Pond Beta",
    type: "Aquaculture",
    clusters: 2,
    devices: 8,
    status: "operational",
    location: "Bogor",
    lat: -6.5971,
    lng: 106.8060
  },
  {
    id: "SITE003",
    name: "Livestock Farm Gamma",
    type: "Livestock",
    clusters: 4,
    devices: 16,
    status: "maintenance",
    location: "Bandung",
    lat: -6.9175,
    lng: 107.6191
  },
  {
    id: "SITE004",
    name: "Crop Field Delta",
    type: "Agriculture",
    clusters: 5,
    devices: 20,
    status: "operational",
    location: "Bekasi",
    lat: -6.2382,
    lng: 106.9756
  }
];

export default function Sites() {
  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Sites Management</h1>
          <p className="text-muted-foreground">Monitor and manage all your agricultural sites</p>
        </div>

        {/* Map View */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Site Locations</h2>
          <MapView 
            locations={sites} 
            center={[-6.4, 106.9]} 
            zoom={10}
            height="400px"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sites.map((site) => (
            <Card key={site.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      {site.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{site.location}</p>
                  </div>
                  <Badge 
                    variant={site.status === "operational" ? "default" : "secondary"}
                    className={site.status === "operational" ? "bg-success" : ""}
                  >
                    {site.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{site.type}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Layers className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Clusters</p>
                      <p className="text-lg font-bold">{site.clusters}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <Activity className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Devices</p>
                      <p className="text-lg font-bold">{site.devices}</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground pt-2">
                  Site ID: {site.id}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
