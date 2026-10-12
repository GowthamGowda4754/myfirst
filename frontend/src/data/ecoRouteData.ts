export type PagePath =
  | 'auth'
  | 'dashboard'
  | 'route-planner'
  | 'air-quality'
  | 'hotspots'
  | 'forecast'
  | 'health-guidance'
  | 'about-ecoroute'
  | 'settings';

export interface StationData {
  id: string;
  name: string;
  stationTitle: string;
  position: { lat: number; lng: number };
  aqi: number;
  aqiStatus: 'Good' | 'Moderate' | 'Sensitive';
  pm25: number;
  pm25Note: string;
  pm10: number;
  pm10Note: string;
  no2: number;
  o3: number;
  tempC: number;
  tempF: number;
  tempNote: string;
  humidity: number;
  humidityNote: string;
  openWindowUntil: string;
  activeCongestionZones: number;
  greenwayReductionPct: number;
  hourlyAqi: { time: string; value: number; isNow?: boolean }[];
  sevenDayAqi: { day: string; value: number; isToday?: boolean }[];
}

export interface HotspotItem {
  id: string;
  name: string;
  shortLabel: string;
  category: 'traffic' | 'industrial';
  position: { lat: number; lng: number };
  aqi: number;
  pm25: number;
  pm10: number;
  cause: string;
  bypassSuggestion: string;
  topClass: string;
  leftClass?: string;
  rightClass?: string;
  bottomClass?: string;
  toastText: string;
  trend: 'Rising' | 'Peak' | 'Clearing';
}

export interface RouteOption {
  id: string;
  name: string;
  badge: string;
  durationMins: number;
  distanceKm: number;
  avgAqi: number;
  pm25Exposure: number;
  pm25DeltaPct: number;
  treeCanopyKm: number;
  description: string;
  waypoints: string[];
  recommended: boolean;
  mode: 'walk' | 'bike' | 'transit' | 'drive';
}

export const STATIONS: StationData[] = [
  {
    id: 'downtown',
    name: 'Downtown Central (Demo)',
    stationTitle: 'Financial District • Station #04',
    position: { lat: 37.7915, lng: -122.3998 },
    aqi: 42,
    aqiStatus: 'Good',
    pm25: 9.4,
    pm25Note: 'Optimal purity',
    pm10: 18.2,
    pm10Note: 'Within WHO Limit',
    no2: 14.1,
    o3: 28.5,
    tempC: 21,
    tempF: 70,
    tempNote: 'Mild commuter breeze',
    humidity: 54,
    humidityNote: 'Normal dispersity',
    openWindowUntil: '4:30 PM',
    activeCongestionZones: 2,
    greenwayReductionPct: 38,
    hourlyAqi: [
      { time: '1PM', value: 36 },
      { time: 'NOW', value: 42, isNow: true },
      { time: '3PM', value: 45 },
      { time: '4PM', value: 49 },
      { time: '5PM', value: 68 },
      { time: '6PM', value: 74 },
      { time: '7PM', value: 52 },
    ],
    sevenDayAqi: [
      { day: 'Mon', value: 38 },
      { day: 'Today', value: 42, isToday: true },
      { day: 'Wed', value: 35 },
      { day: 'Thu', value: 44 },
      { day: 'Fri', value: 58 },
      { day: 'Sat', value: 29 },
      { day: 'Sun', value: 31 },
    ],
  },
  {
    id: 'waterfront',
    name: 'Waterfront Botanical',
    stationTitle: 'Bayfront Greenway • Station #09',
    position: { lat: 37.7955, lng: -122.3937 },
    aqi: 26,
    aqiStatus: 'Good',
    pm25: 5.8,
    pm25Note: 'Marine air flush',
    pm10: 12.4,
    pm10Note: 'Ultra-clean zone',
    no2: 8.2,
    o3: 22.0,
    tempC: 19,
    tempF: 66,
    tempNote: 'Cool coastal breeze',
    humidity: 62,
    humidityNote: 'High sea dispersion',
    openWindowUntil: '6:15 PM',
    activeCongestionZones: 1,
    greenwayReductionPct: 46,
    hourlyAqi: [
      { time: '1PM', value: 24 },
      { time: 'NOW', value: 26, isNow: true },
      { time: '3PM', value: 29 },
      { time: '4PM', value: 33 },
      { time: '5PM', value: 44 },
      { time: '6PM', value: 47 },
      { time: '7PM', value: 31 },
    ],
    sevenDayAqi: [
      { day: 'Mon', value: 27 },
      { day: 'Today', value: 26, isToday: true },
      { day: 'Wed', value: 25 },
      { day: 'Thu', value: 30 },
      { day: 'Fri', value: 39 },
      { day: 'Sat', value: 22 },
      { day: 'Sun', value: 24 },
    ],
  },
  {
    id: 'east-rail',
    name: 'East Harbor Corridor',
    stationTitle: 'Logistics & Rail Hub • Station #12',
    position: { lat: 37.7765, lng: -122.3905 },
    aqi: 64,
    aqiStatus: 'Moderate',
    pm25: 17.6,
    pm25Note: 'Elevated particulates',
    pm10: 36.8,
    pm10Note: 'Freight corridor load',
    no2: 29.4,
    o3: 34.1,
    tempC: 23,
    tempF: 73,
    tempNote: 'Urban heat pocket',
    humidity: 47,
    humidityNote: 'Slower vertical mix',
    openWindowUntil: '3:15 PM',
    activeCongestionZones: 4,
    greenwayReductionPct: 51,
    hourlyAqi: [
      { time: '1PM', value: 55 },
      { time: 'NOW', value: 64, isNow: true },
      { time: '3PM', value: 69 },
      { time: '4PM', value: 76 },
      { time: '5PM', value: 88 },
      { time: '6PM', value: 84 },
      { time: '7PM', value: 62 },
    ],
    sevenDayAqi: [
      { day: 'Mon', value: 58 },
      { day: 'Today', value: 64, isToday: true },
      { day: 'Wed', value: 54 },
      { day: 'Thu', value: 61 },
      { day: 'Fri', value: 75 },
      { day: 'Sat', value: 41 },
      { day: 'Sun', value: 39 },
    ],
  },
];

export const HOTSPOTS: HotspotItem[] = [
  {
    id: 'central-tunnel',
    name: 'Central Tunnel Approach',
    shortLabel: 'Tunnel AQI 84',
    category: 'traffic',
    position: { lat: 37.7946, lng: -122.4068 },
    aqi: 84,
    pm25: 48.0,
    pm10: 56.2,
    cause: 'Dense tunnel portal traffic & exhaust trapping',
    bypassSuggestion: 'Detour via Emerald Park Bikeway (-42% PM2.5)',
    topClass: 'top-10',
    leftClass: 'left-8',
    toastText: 'Central Tunnel: PM2.5 48 µg/m³ · Dense Traffic',
    trend: 'Peak',
  },
  {
    id: 'harbor-depot',
    name: 'Harbor Rail Depot',
    shortLabel: 'Depot AQI 92',
    category: 'industrial',
    position: { lat: 37.7812, lng: -122.3885 },
    aqi: 92,
    pm25: 34.5,
    pm10: 72.0,
    cause: 'Freight diesel locomotives & container cranes',
    bypassSuggestion: 'Use Shoreline Boardwalk 400m upwind',
    topClass: 'top-7',
    rightClass: 'right-8',
    toastText: 'Harbor Rail Depot: PM10 72 µg/m³ · Freight Diesel',
    trend: 'Rising',
  },
  {
    id: 'main-overpass',
    name: 'Main St Overpass',
    shortLabel: 'Overpass AQI 71',
    category: 'traffic',
    position: { lat: 37.7868, lng: -122.3948 },
    aqi: 71,
    pm25: 39.0,
    pm10: 45.8,
    cause: 'Stop-and-go arterial merge beneath concrete deck',
    bypassSuggestion: 'Cross at 6th St Pedestrian Bridge instead',
    bottomClass: 'bottom-12',
    leftClass: 'left-20',
    topClass: '',
    toastText: 'Main St Overpass: PM2.5 39 µg/m³ · Stop-and-go',
    trend: 'Peak',
  },
  {
    id: 'broad-underpass',
    name: 'Broad Ave & 4th Underpass',
    shortLabel: 'Broad AQI 78',
    category: 'traffic',
    position: { lat: 37.7824, lng: -122.4015 },
    aqi: 78,
    pm25: 41.2,
    pm10: 49.0,
    cause: 'Idling commuter buses & delivery vans',
    bypassSuggestion: 'Route through Botanical Promenade North',
    topClass: 'top-24',
    leftClass: 'left-44',
    toastText: 'Broad Ave Underpass: PM2.5 41.2 µg/m³ · Idling Traffic',
    trend: 'Rising',
  },
  {
    id: 'south-concrete',
    name: 'Southside Batching Plant',
    shortLabel: 'Plant AQI 81',
    category: 'industrial',
    position: { lat: 37.7728, lng: -122.3912 },
    aqi: 81,
    pm25: 27.4,
    pm10: 66.5,
    cause: 'Coarse mineral dust & aggregate loading',
    bypassSuggestion: 'Take West Canal Towpath (+2 min)',
    bottomClass: 'bottom-14',
    rightClass: 'right-20',
    topClass: '',
    toastText: 'Southside Batching Plant: PM10 66.5 µg/m³ · Coarse Dust',
    trend: 'Clearing',
  },
  {
    id: 'midtown-interchange',
    name: 'I-80 Midtown Ramp',
    shortLabel: 'Ramp AQI 69',
    category: 'traffic',
    position: { lat: 37.7852, lng: -122.3965 },
    aqi: 69,
    pm25: 31.8,
    pm10: 42.1,
    cause: 'Afternoon highway ramp queue',
    bypassSuggestion: 'Use Cedar Ave Protected Bike Lane',
    topClass: 'top-16',
    rightClass: 'right-32',
    toastText: 'I-80 Midtown Ramp: PM2.5 31.8 µg/m³ · Ramp Queue',
    trend: 'Clearing',
  },
  {
    id: 'dockside-foundry',
    name: 'East Dock Thermal Works',
    shortLabel: 'Dock AQI 76',
    category: 'industrial',
    position: { lat: 37.7755, lng: -122.3872 },
    aqi: 76,
    pm25: 29.9,
    pm10: 58.4,
    cause: 'Afternoon boiler cycle & truck staging',
    bypassSuggestion: 'Follow Greenway Rim Trail West',
    bottomClass: 'bottom-24',
    leftClass: 'left-6',
    topClass: '',
    toastText: 'East Dock Works: PM10 58.4 µg/m³ · Industrial Plume',
    trend: 'Rising',
  },
];

export const ROUTE_OPTIONS: RouteOption[] = [
  {
    id: 'greenway-corridor',
    name: 'Emerald Greenway Corridor',
    badge: 'Lowest PM2.5 Exposure',
    durationMins: 19,
    distanceKm: 3.4,
    avgAqi: 28,
    pm25Exposure: 6.8,
    pm25DeltaPct: -38,
    treeCanopyKm: 1.8,
    description: 'Routes through the urban botanical corridor and protected waterfront path, avoiding Broad Ave & Central Tunnel exhaust.',
    waypoints: ['Ferry Building, San Francisco, CA', 'Embarcadero Promenade', 'Civic Center Plaza, San Francisco, CA'],
    recommended: true,
    mode: 'bike',
  },
  {
    id: 'civic-boulevard',
    name: 'Civic Avenue Protected Lane',
    badge: 'Balanced Time & Air',
    durationMins: 17,
    distanceKm: 3.1,
    avgAqi: 41,
    pm25Exposure: 9.6,
    pm25DeltaPct: -14,
    treeCanopyKm: 0.9,
    description: 'Uses separated transit-only streets with moderate street-tree buffering and signal prioritization.',
    waypoints: ['Ferry Building, San Francisco, CA', 'Market St Bikeway', 'Civic Center Plaza, San Francisco, CA'],
    recommended: false,
    mode: 'bike',
  },
  {
    id: 'broad-arterial',
    name: 'Broad Ave & Tunnel Direct',
    badge: 'Fastest · High Exposure',
    durationMins: 16,
    distanceKm: 2.9,
    avgAqi: 76,
    pm25Exposure: 15.8,
    pm25DeltaPct: 0,
    treeCanopyKm: 0.2,
    description: 'Direct arterial route passing Central Tunnel portal and Main St Overpass congestion zones.',
    waypoints: ['Ferry Building, San Francisco, CA', 'Central Tunnel Approach', 'Civic Center Plaza, San Francisco, CA'],
    recommended: false,
    mode: 'bike',
  },
];
