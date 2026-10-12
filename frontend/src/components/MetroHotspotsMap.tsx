import React, { useEffect, useRef, useState } from 'react';
import {
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { HotspotItem, StationData } from '../data/ecoRouteData';

interface MetroHotspotsMapProps {
  hotspots: HotspotItem[];
  stations?: StationData[];
  activeFilter: 'all' | 'traffic' | 'industrial';
  selectedHotspotId: string | null;
  onSelectHotspot: (hotspot: HotspotItem) => void;
  greenwayAqi?: number;
  heightClass?: string;
  routeOrigin?: string;
  routeDestination?: string;
  travelMode?: 'bike' | 'walk' | 'transit';
  onRouteCalculated?: (details: { distanceKm: number; durationMins: number }) => void;
}

interface RouteOverlayProps {
  origin: string;
  destination: string;
  travelMode: 'bike' | 'walk' | 'transit';
  onRouteCalculated?: (details: { distanceKm: number; durationMins: number }) => void;
}

const RouteOverlay: React.FC<RouteOverlayProps> = ({
  origin,
  destination,
  travelMode,
  onRouteCalculated,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylinesRef = useRef<any[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;

    // Clean up existing polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const sdkMode =
      travelMode === 'walk'
        ? 'WALKING'
        : travelMode === 'transit'
        ? 'TRANSIT'
        : 'BICYCLING';

    const RouteClass = (routesLib as unknown as { Route?: { computeRoutes?: (req: unknown) => Promise<{ routes?: any[] }> } }).Route;
    if (!RouteClass || typeof RouteClass.computeRoutes !== 'function') return;

    const request = {
      origin,
      destination,
      travelMode: sdkMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    RouteClass.computeRoutes(request)
      .then((res) => {
        const primaryRoute = res?.routes?.[0];
        if (!primaryRoute) return;

        if (typeof primaryRoute.createPolylines === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newPolylines: any[] = primaryRoute.createPolylines();
          newPolylines.forEach((polyline) => {
            polyline.setOptions({
              strokeColor: '#006c48',
              strokeWeight: 6,
              strokeOpacity: 0.9,
            });
            polyline.setMap(map);
          });
          polylinesRef.current = newPolylines;
        }

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        if (onRouteCalculated && primaryRoute.distanceMeters && primaryRoute.durationMillis) {
          onRouteCalculated({
            distanceKm: Number((primaryRoute.distanceMeters / 1000).toFixed(1)),
            durationMins: Math.max(1, Math.round(primaryRoute.durationMillis / 60000)),
          });
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('429') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        console.error('Error computing clean-air route:', err);
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin, destination, travelMode]);

  return null;
};

export const MetroHotspotsMap: React.FC<MetroHotspotsMapProps> = ({
  hotspots,
  stations = [],
  activeFilter,
  selectedHotspotId,
  onSelectHotspot,
  greenwayAqi = 28,
  heightClass = 'h-64',
  routeOrigin,
  routeDestination,
  travelMode = 'bike',
  onRouteCalculated,
}) => {
  const [infoWindowSpot, setInfoWindowSpot] = useState<HotspotItem | null>(null);

  const visibleHotspots = hotspots.filter(
    (h) => activeFilter === 'all' || h.category === activeFilter
  );

  const selectedSpot =
    visibleHotspots.find((h) => h.id === selectedHotspotId) || infoWindowSpot;

  return (
    <div
      className={`relative w-full ${heightClass} rounded-xl overflow-hidden bg-surface-container-high border border-outline-variant/40`}
    >
      <Map
        mapId="DEMO_MAP_ID"
        defaultCenter={{ lat: 37.7865, lng: -122.3965 }}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={false}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        className="w-full h-full"
      >
        {/* Render Clean Air Monitoring Stations */}
        {stations.map((st) => (
          <AdvancedMarker
            key={st.id}
            position={st.position}
            title={`${st.name} • AQI ${st.aqi}`}
          >
            <div className="px-2 py-1 rounded-full bg-primary-container text-on-primary shadow-md border border-white flex items-center gap-1 text-[11px] font-semibold tabular-nums">
              <span className="material-symbols-outlined text-[13px] text-secondary-fixed">
                sensors
              </span>
              <span>AQI {st.aqi}</span>
            </div>
          </AdvancedMarker>
        ))}

        {/* Render Pollution Hotspot AdvancedMarkers */}
        {visibleHotspots.map((spot) => {
          const isTraffic = spot.category === 'traffic';
          const isSelected = selectedHotspotId === spot.id;

          return (
            <AdvancedMarker
              key={spot.id}
              position={spot.position}
              title={`${spot.name} (AQI ${spot.aqi})`}
              onClick={() => {
                setInfoWindowSpot(spot);
                onSelectHotspot(spot);
              }}
            >
              <div
                className={`hotspot-pin ${spot.category} flex items-center gap-1.5 cursor-pointer transition-transform ${
                  isSelected ? 'scale-110 z-30' : 'hover:scale-105 z-20'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full ${
                    isTraffic ? 'bg-error text-on-error' : 'bg-tertiary text-on-primary'
                  } flex items-center justify-center text-[11px] font-bold shadow-md ring-2 ring-white`}
                >
                  {isTraffic ? '!' : '#'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded shadow-md text-[11px] font-semibold tabular-nums whitespace-nowrap ${
                    isSelected
                      ? 'bg-inverse-surface text-inverse-on-surface ring-1 ring-secondary-fixed'
                      : 'bg-surface-container-lowest/95 text-on-surface'
                  }`}
                >
                  {spot.shortLabel}
                </span>
              </div>
            </AdvancedMarker>
          );
        })}

        {/* InfoWindow for Active Hotspot */}
        {selectedSpot && (
          <InfoWindow
            position={selectedSpot.position}
            onCloseClick={() => setInfoWindowSpot(null)}
            maxWidth={240}
          >
            <div className="p-1 text-on-surface space-y-1">
              <div className="font-semibold text-xs text-primary">
                {selectedSpot.name}
              </div>
              <div className="text-[11px] text-error font-semibold tabular-nums">
                US AQI {selectedSpot.aqi} · PM2.5 {selectedSpot.pm25} µg/m³
              </div>
              <div className="text-[11px] text-on-surface-variant">
                {selectedSpot.cause}
              </div>
              <div className="text-[11px] text-secondary font-medium">
                {selectedSpot.bypassSuggestion}
              </div>
            </div>
          </InfoWindow>
        )}

        {/* Modern Routes API Polyline Overlay when Origin & Destination are provided */}
        {routeOrigin && routeDestination && (
          <RouteOverlay
            origin={routeOrigin}
            destination={routeDestination}
            travelMode={travelMode}
            onRouteCalculated={onRouteCalculated}
          />
        )}
      </Map>

      {/* Green Corridor Highlighted Route Tag */}
      <div className="absolute bottom-2.5 left-2.5 z-20 bg-primary-container/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md pointer-events-none">
        <span className="material-symbols-outlined text-secondary-fixed text-[16px]">
          park
        </span>
        <span className="font-label-sm text-label-sm text-on-primary tabular-nums whitespace-nowrap">
          EcoRoute Greenway: Clear (AQI {greenwayAqi})
        </span>
      </div>
    </div>
  );
};
