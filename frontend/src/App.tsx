import React, { useState, useEffect, useRef } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  PagePath,
  STATIONS,
  HOTSPOTS,
  ROUTE_OPTIONS,
  HotspotItem,
  RouteOption,
} from './data/ecoRouteData';
import { MetroHotspotsMap } from './components/MetroHotspotsMap';
import { AuthView } from './components/AuthView';

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

interface SavedRouteRecord {
  id: string;
  uid: string;
  name: string;
  origin: string;
  destination: string;
  travelMode: 'bike' | 'walk' | 'transit';
  avgAqi: number;
  pm25Exposure: number;
  durationMins: number;
  distanceKm: number;
}

export default function App() {
  const [activePage, setActivePage] = useState<PagePath>('auth');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stationIndex, setStationIndex] = useState(0);
  const [stationMenuOpen, setStationMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Google Maps Quota Exceeded Banner State (Section 8 Case A)
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  // Firebase Auth & User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteRecord[]>([]);

  // Dashboard & Hotspot states
  const [trendMode, setTrendMode] = useState<'hourly' | '7day'>('hourly');
  const [hotspotFilter, setHotspotFilter] = useState<'all' | 'traffic' | 'industrial'>('all');
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotItem | null>(HOTSPOTS[0]);

  // Route planner state
  const [originInput, setOriginInput] = useState('Ferry Building, San Francisco, CA');
  const [destInput, setDestInput] = useState('Civic Center Plaza, San Francisco, CA');
  const [travelMode, setTravelMode] = useState<'bike' | 'walk' | 'transit'>('bike');
  const [selectedRouteId, setSelectedRouteId] = useState<string>(ROUTE_OPTIONS[0].id);
  const [activeNavigationRoute, setActiveNavigationRoute] = useState<RouteOption | null>(null);
  const [liveRouteStats, setLiveRouteStats] = useState<{
    distanceKm: number;
    durationMins: number;
  } | null>(null);

  // Settings & Health Guidance state
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [sensitiveGroupMode, setSensitiveGroupMode] = useState<boolean>(false);
  const [aqiAlertThreshold, setAqiAlertThreshold] = useState<number>(60);
  const [commuteReminder, setCommuteReminder] = useState<boolean>(true);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const currentStation = STATIONS[stationIndex];

  const showHotspotToast = (text: string) => {
    setToastMessage(text);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Listen to Firebase Auth state & load/sync commuter profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthReady(true);

      if (user) {
        const userDocPath = `users/${user.uid}`;
        const userRef = doc(db, 'users', user.uid);
        try {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.preferredMode === 'bike' || data.preferredMode === 'walk' || data.preferredMode === 'transit') {
              setTravelMode(data.preferredMode);
            }
            if (data.tempUnit === 'C' || data.tempUnit === 'F') {
              setTempUnit(data.tempUnit);
            }
            if (typeof data.sensitiveGroupMode === 'boolean') {
              setSensitiveGroupMode(data.sensitiveGroupMode);
            }
            if (typeof data.aqiAlertThreshold === 'number') {
              setAqiAlertThreshold(data.aqiAlertThreshold);
            }
            if (typeof data.commuteReminder === 'boolean') {
              setCommuteReminder(data.commuteReminder);
            }
          } else {
            // Create initial commuter profile adhering strictly to firebase-blueprint.json
            const cleanDisplayName = (user.displayName || user.email?.split('@')[0] || 'Commuter').slice(0, 80);
            await setDoc(userRef, {
              uid: user.uid,
              displayName: cleanDisplayName,
              preferredMode: 'bike',
              tempUnit: 'C',
              sensitiveGroupMode: false,
              aqiAlertThreshold: 60,
              commuteReminder: true,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, userDocPath);
        }
      } else {
        setSavedRoutes([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Attach real-time listener for user's saved clean-air routes once authenticated
  useEffect(() => {
    if (!authReady || !currentUser) return;

    const routesPath = `users/${currentUser.uid}/savedRoutes`;
    const routesQuery = query(
      collection(db, 'users', currentUser.uid, 'savedRoutes'),
      where('uid', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      routesQuery,
      (snapshot) => {
        const items: SavedRouteRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: String(data.uid),
            name: String(data.name),
            origin: String(data.origin),
            destination: String(data.destination),
            travelMode: data.travelMode as 'bike' | 'walk' | 'transit',
            avgAqi: Number(data.avgAqi),
            pm25Exposure: Number(data.pm25Exposure),
            durationMins: Number(data.durationMins),
            distanceKm: Number(data.distanceKm),
          };
        });
        setSavedRoutes(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, routesPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, currentUser]);

  // Save updated preferences to Firestore if signed in
  const syncUserPreferences = async (overrides: {
    preferredMode?: 'bike' | 'walk' | 'transit';
    tempUnit?: 'C' | 'F';
    sensitiveGroupMode?: boolean;
    aqiAlertThreshold?: number;
    commuteReminder?: boolean;
  }) => {
    if (!currentUser) return;
    const userDocPath = `users/${currentUser.uid}`;
    const userRef = doc(db, 'users', currentUser.uid);
    const cleanDisplayName = (
      currentUser.displayName ||
      currentUser.email?.split('@')[0] ||
      'Commuter'
    ).slice(0, 80);

    try {
      await setDoc(userRef, {
        uid: currentUser.uid,
        displayName: cleanDisplayName,
        preferredMode: overrides.preferredMode ?? travelMode,
        tempUnit: overrides.tempUnit ?? tempUnit,
        sensitiveGroupMode: overrides.sensitiveGroupMode ?? sensitiveGroupMode,
        aqiAlertThreshold: Math.min(
          150,
          Math.max(40, Math.round(overrides.aqiAlertThreshold ?? aqiAlertThreshold))
        ),
        commuteReminder: overrides.commuteReminder ?? commuteReminder,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userDocPath);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const result = await signInWithGoogle();
      setProfileOpen(false);
      setActivePage('dashboard');
      showHotspotToast(`Signed in as ${result.user.displayName || result.user.email}`);
    } catch (err) {
      console.error('Sign-in error:', err);
      showHotspotToast('Sign-in was cancelled or could not complete.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutUser();
      setProfileOpen(false);
      setActivePage('auth');
      showHotspotToast('Signed out of EcoRoute account.');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const handleBookmarkRoute = async (route: RouteOption) => {
    if (!currentUser) {
      showHotspotToast('Sign in with Google to bookmark routes to your profile.');
      setProfileOpen(true);
      return;
    }

    const routesPath = `users/${currentUser.uid}/savedRoutes`;
    try {
      await addDoc(collection(db, 'users', currentUser.uid, 'savedRoutes'), {
        uid: currentUser.uid,
        name: route.name.slice(0, 100),
        origin: originInput.trim().slice(0, 160) || 'Downtown Central',
        destination: destInput.trim().slice(0, 160) || 'Midtown Civic Plaza',
        travelMode,
        avgAqi: Math.min(500, Math.max(0, Math.round(route.avgAqi))),
        pm25Exposure: Math.min(500, Math.max(0, Number(route.pm25Exposure))),
        durationMins: Math.min(
          600,
          Math.max(1, Math.round(liveRouteStats?.durationMins ?? route.durationMins))
        ),
        distanceKm: Math.min(
          500,
          Math.max(0, Number(liveRouteStats?.distanceKm ?? route.distanceKm))
        ),
        createdAt: serverTimestamp(),
      });
      showHotspotToast(`Saved "${route.name}" to your commuter account`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, routesPath);
    }
  };

  const handleDeleteSavedRoute = async (routeId: string) => {
    if (!currentUser) return;
    const docPath = `users/${currentUser.uid}/savedRoutes/${routeId}`;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'savedRoutes', routeId));
      showHotspotToast('Removed bookmarked route');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  };

  const handleNavigate = (page: PagePath, toastText?: string) => {
    setActivePage(page);
    setDrawerOpen(false);
    setStationMenuOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (toastText) {
      showHotspotToast(toastText);
    }
  };

  const handleSelectStation = (idx: number) => {
    setStationIndex(idx);
    setStationMenuOpen(false);
    showHotspotToast(`Switched telemetry station to ${STATIONS[idx].name}`);
  };

  const getGaugeArcPath = (aqiValue: number) => {
    const clamped = Math.max(8, Math.min(300, aqiValue));
    const ratio = clamped / 300;
    const angle = Math.PI * (1 - ratio);
    const cx = 96;
    const cy = 98;
    const r = 80;
    const endX = cx + r * Math.cos(angle);
    const endY = cy - r * Math.sin(angle);
    return `M 16 98 A 80 80 0 0 1 ${endX.toFixed(1)} ${endY.toFixed(1)}`;
  };

  const filteredHotspots = HOTSPOTS.filter(
    (h) => hotspotFilter === 'all' || h.category === hotspotFilter
  );

  const trafficCount = HOTSPOTS.filter((h) => h.category === 'traffic').length;
  const industrialCount = HOTSPOTS.filter((h) => h.category === 'industrial').length;

  const navItems: { path: PagePath; label: string; icon: string }[] = [
    { path: 'auth', label: currentUser ? 'My Account' : 'Login / Register', icon: 'account_circle' },
    { path: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: 'route-planner', label: 'Route Planner', icon: 'directions' },
    { path: 'air-quality', label: 'Air Quality', icon: 'air' },
    { path: 'hotspots', label: 'Hotspots', icon: 'crisis_alert' },
    { path: 'forecast', label: 'Forecast', icon: 'schedule' },
    { path: 'health-guidance', label: 'Health Guidance', icon: 'health_and_safety' },
    { path: 'about-ecoroute', label: 'About EcoRoute', icon: 'info' },
    { path: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const bottomTabs: { path: PagePath; label: string; icon: string }[] = [
    { path: 'auth', label: currentUser ? 'Account' : 'Login', icon: 'account_circle' },
    { path: 'dashboard', label: 'Dashboard', icon: 'home' },
    { path: 'route-planner', label: 'Routes', icon: 'directions' },
    { path: 'hotspots', label: 'Hotspots', icon: 'crisis_alert' },
    { path: 'forecast', label: 'Forecast', icon: 'schedule' },
  ];

  const userInitials = currentUser?.displayName
    ? currentUser.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : currentUser?.email
    ? currentUser.email.slice(0, 2).toUpperCase()
    : null;

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased flex flex-col">
        {/* Mandatory Google Maps Platform Demo Key Quota Banner */}
        {gmpQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Top App Bar */}
        <header className="fixed top-0 w-full z-50 pt-safe bg-surface-container-lowest/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(8,28,21,0.04)]">
          <div className="max-w-6xl mx-auto h-16 px-space-md flex items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-xs">
              <button
                aria-label="Open Menu"
                onClick={() => setDrawerOpen(true)}
                className="w-11 h-11 flex items-center justify-center rounded-lg text-primary hover:bg-surface-container transition-colors cursor-pointer"
                id="menuToggle"
              >
                <span className="material-symbols-outlined text-[24px]">menu</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleNavigate('dashboard')}
                  className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shadow-xs cursor-pointer"
                  aria-label="EcoRoute Home"
                >
                  <span className="material-symbols-outlined text-[20px]">eco</span>
                </button>
                <div className="flex flex-col relative">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleNavigate('dashboard')}
                      className="font-headline-sm text-headline-sm text-primary leading-none cursor-pointer"
                    >
                      EcoRoute
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStationMenuOpen((prev) => !prev);
                      setNotificationsOpen(false);
                      setProfileOpen(false);
                    }}
                    className="flex items-center text-left text-on-surface-variant font-label-sm text-label-sm hover:text-primary transition-colors cursor-pointer"
                  >
                    <span className="truncate max-w-[140px] sm:max-w-xs">
                      {currentStation.name}
                    </span>
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_drop_down
                    </span>
                  </button>

                  {/* Station Selector Dropdown */}
                  {stationMenuOpen && (
                    <div className="absolute top-12 left-0 w-64 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/40 py-1.5 z-50">
                      <div className="px-3 py-1 text-on-surface-variant font-label-sm text-label-sm border-b border-surface-container">
                        Select Telemetry Corridor
                      </div>
                      {STATIONS.map((st, idx) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSelectStation(idx)}
                          className={`w-full px-3 py-2.5 text-left flex items-center justify-between hover:bg-surface-container transition-colors ${
                            idx === stationIndex
                              ? 'bg-surface-container-low text-primary font-semibold'
                              : 'text-on-surface'
                          }`}
                        >
                          <div>
                            <div className="font-label-md text-label-md">{st.name}</div>
                            <div className="font-body-sm text-body-sm text-on-surface-variant">
                              {st.stationTitle}
                            </div>
                          </div>
                          <span className="font-code-metric text-label-md tabular-nums text-primary">
                            AQI {st.aqi}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Quick Nav Links */}
            <nav className="hidden lg:flex items-center gap-6">
              {bottomTabs.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavigate(item.path)}
                  className={`font-label-lg text-label-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activePage === item.path
                      ? 'text-primary font-semibold underline underline-offset-8 decoration-2'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Right Action Controls (Notifications & Login / Profile) */}
            <div className="flex items-center gap-space-xs relative">
              <button
                aria-label="Notifications"
                type="button"
                onClick={() => {
                  setNotificationsOpen((prev) => !prev);
                  setStationMenuOpen(false);
                  setProfileOpen(false);
                }}
                className="w-11 h-11 relative flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface-container-lowest" />
              </button>

              {currentUser ? (
                <button
                  aria-label="User Commuter Profile"
                  type="button"
                  onClick={() => {
                    setProfileOpen((prev) => !prev);
                    setNotificationsOpen(false);
                    setStationMenuOpen(false);
                  }}
                  className="h-11 px-2 flex items-center gap-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Profile'}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-fixed"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-label-md text-label-md flex items-center justify-center ring-2 ring-primary-fixed">
                      {userInitials}
                    </div>
                  )}
                  <span className="hidden sm:inline font-label-md text-label-md text-primary max-w-[110px] truncate">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleNavigate('auth')}
                  className="h-10 px-3.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md flex items-center gap-1.5 shadow-xs hover:opacity-95 active:scale-98 transition-all cursor-pointer whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  <span>Log In / Register</span>
                </button>
              )}

              {/* Notifications Popover */}
              {notificationsOpen && (
                <div className="absolute top-13 right-0 w-76 sm:w-80 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/40 p-space-sm z-50 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-surface-container">
                    <span className="font-label-lg text-label-lg text-on-surface">
                      Environmental Alerts
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-primary font-label-sm text-label-sm cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low space-y-1">
                    <div className="flex items-center justify-between font-label-sm text-label-sm text-error">
                      <span>Broad Ave &amp; 4th Underpass</span>
                      <span>12m ago</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface">
                      PM2.5 rose to 41.2 µg/m³ due to idling traffic peak. Greenway bypass active.
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-container-low space-y-1">
                    <div className="flex items-center justify-between font-label-sm text-label-sm text-primary">
                      <span>Low Exposure Window</span>
                      <span>Active now</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface">
                      Clean commuter breeze until {currentStation.openWindowUntil} at{' '}
                      {currentStation.name}.
                    </p>
                  </div>
                </div>
              )}

              {/* Profile & Account Popover */}
              {profileOpen && (
                <div className="absolute top-13 right-0 w-72 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/40 p-space-sm z-50 space-y-2.5">
                  {currentUser ? (
                    <>
                      <div className="pb-2 border-b border-surface-container">
                        <div className="font-label-lg text-label-lg text-on-surface truncate">
                          {currentUser.displayName || 'EcoRoute Commuter'}
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant truncate">
                          {currentUser.email}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-body-sm">
                        <span className="text-on-surface-variant">Bookmarked Routes</span>
                        <span className="font-semibold text-primary tabular-nums">
                          {savedRoutes.length} saved
                        </span>
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleNavigate('auth')}
                          className="flex-1 py-2 px-2 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm hover:bg-surface-container-highest transition-colors cursor-pointer text-center"
                        >
                          Account
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNavigate('settings')}
                          className="flex-1 py-2 px-2 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm hover:bg-surface-container-highest transition-colors cursor-pointer text-center"
                        >
                          Settings
                        </button>
                        <button
                          type="button"
                          onClick={handleGoogleSignOut}
                          className="flex-1 py-2 px-2 rounded-lg bg-error-container text-on-error-container font-label-sm text-label-sm hover:opacity-95 transition-opacity cursor-pointer text-center"
                        >
                          Sign Out
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="font-label-lg text-label-lg text-on-surface font-semibold">
                        Sign in to EcoRoute
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Sync your respiratory alert thresholds and bookmark clean-air routes across devices.
                      </p>
                      <div className="flex flex-col gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleNavigate('auth')}
                          className="w-full py-2.5 px-3 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                          <span className="material-symbols-outlined text-[18px]">login</span>
                          <span>Log In / Register</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleGoogleSignIn}
                          disabled={authLoading}
                          className="w-full py-2 px-3 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-surface-container-highest"
                        >
                          <span>Quick Sign In with Google</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Navigation Drawer Backdrop */}
        {drawerOpen && (
          <div
            id="drawerBackdrop"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs transition-opacity"
          />
        )}

        {/* Navigation Drawer */}
        <aside
          id="navDrawer"
          className={`fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-surface-container-lowest shadow-[0_20px_25px_-5px_rgba(8,28,21,0.15)] transform transition-transform duration-200 flex flex-col pt-safe pb-safe ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-16 px-space-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary-container text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">eco</span>
              </div>
              <span className="font-headline-sm text-headline-sm text-primary">EcoRoute</span>
            </div>
            <button
              id="closeDrawer"
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container cursor-pointer"
              aria-label="Close Menu"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Drawer Account Section */}
          <div className="px-space-md py-space-sm mx-space-md mb-1 rounded-lg bg-surface-container-low flex items-center justify-between gap-2">
            {currentUser ? (
              <div className="min-w-0">
                <div className="font-label-md text-label-md text-primary truncate">
                  {currentUser.displayName || 'Commuter'}
                </div>
                <div className="font-label-sm text-label-sm text-on-surface-variant truncate">
                  {currentUser.email}
                </div>
              </div>
            ) : (
              <div className="font-label-sm text-label-sm text-on-surface-variant">
                Guest Commuter
              </div>
            )}
            {currentUser ? (
              <button
                type="button"
                onClick={handleGoogleSignOut}
                className="px-2.5 py-1 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm cursor-pointer shrink-0"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  handleNavigate('auth');
                  setDrawerOpen(false);
                }}
                className="px-2.5 py-1 rounded bg-primary-container text-on-primary font-label-sm text-label-sm cursor-pointer shrink-0"
              >
                Log In / Register
              </button>
            )}
          </div>

          <div className="px-space-md py-space-xs flex items-center gap-2 bg-surface-container-low mx-space-md rounded-lg">
            <span className="material-symbols-outlined text-primary text-[18px]">near_me</span>
            <span className="font-label-md text-label-md text-primary font-semibold truncate">
              {currentStation.name}
            </span>
          </div>

          <nav className="flex-1 overflow-y-auto px-space-sm py-space-sm space-y-1">
            {navItems.map((item) => {
              const isActive = activePage === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavigate(item.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-space-md h-12 rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-secondary-container text-on-secondary-container font-semibold'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                  <span className="font-label-lg text-label-lg">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-space-md">
            <div className="bg-surface-container-high px-space-sm py-2 rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-outline text-[16px]">science</span>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Demo data — not live environmental measurements
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Container */}
        <main className="flex-1 flex flex-col relative w-full pt-16 bg-surface pb-28">
          <div className="w-full max-w-6xl mx-auto px-margin-mobile sm:px-6 flex flex-col space-y-space-md">
            {/* Top Notice Line */}
            <div className="flex items-center justify-center pt-space-xs">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container-high text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-[14px]">science</span>
                <span className="font-label-sm text-label-sm">
                  Demo data — not live environmental measurements
                </span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* VIEW 0: LOGIN OR REGISTER DASHBOARD                       */}
            {/* ========================================================= */}
            {activePage === 'auth' && (
              <AuthView
                currentUser={currentUser}
                onContinueToDashboard={() => handleNavigate('dashboard')}
                onAuthSuccess={() => handleNavigate('dashboard')}
              />
            )}

            {/* ========================================================= */}
            {/* VIEW 1: DASHBOARD                                         */}
            {/* ========================================================= */}
            {activePage === 'dashboard' && (
              <>
                {!currentUser && (
                  <div className="rounded-2xl bg-primary/10 border border-primary/25 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-[22px] shrink-0">
                        account_circle
                      </span>
                      <span className="text-xs sm:text-sm text-on-surface">
                        Currently in <strong>Guest Mode</strong>. Sign in or register to sync commute corridors, custom thresholds, and saved routes.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate('auth')}
                      className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-hover transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Sign In / Register</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-stretch">
                  {/* Hero Welcome Framing */}
                  <div className="lg:col-span-6 relative overflow-hidden rounded-xl bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high p-space-md shadow-xs flex flex-col justify-between">
                    <div className="relative z-10 flex flex-col space-y-space-xs">
                      <div className="inline-flex items-center gap-1 text-primary">
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        <span className="font-label-md text-label-md tracking-wide text-primary">
                          Downtown Metro Live Telemetry
                        </span>
                      </div>
                      <h1 className="font-headline-lg-mobile sm:text-headline-lg text-headline-lg-mobile text-primary tracking-tight">
                        Breathe Better. Travel Smarter.
                      </h1>
                      <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                        Compare commuter routes in real-time based on air-quality indicators, PM2.5 exposure, and travel time.
                      </p>
                    </div>

                    {/* Primary Action CTA */}
                    <div className="relative z-10 pt-space-md space-y-2">
                      <button
                        type="button"
                        id="planRouteBtn"
                        onClick={() =>
                          handleNavigate(
                            'route-planner',
                            'Opening Route Planner: Optimized for lowest PM2.5 exposure...'
                          )
                        }
                        className="w-full flex items-center justify-between px-space-md py-3.5 bg-primary-container text-on-primary rounded-lg shadow-sm active:scale-98 hover:opacity-95 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[22px]">eco</span>
                          <span className="font-label-lg text-label-lg">Plan a Cleaner Route</span>
                        </div>
                        <div className="flex items-center gap-1 bg-surface-container-lowest/15 px-2.5 py-1 rounded-md">
                          <span className="font-label-sm text-label-sm tracking-wide">Start</span>
                          <span className="material-symbols-outlined text-[18px]">
                            arrow_forward
                          </span>
                        </div>
                      </button>

                      {!currentUser && (
                        <div className="flex items-center justify-between px-1 pt-1 text-body-sm text-on-surface-variant">
                          <span>Want to save routes &amp; sync respiratory alerts?</span>
                          <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            className="font-label-md text-label-md text-primary underline cursor-pointer"
                          >
                            Log in with Google
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-secondary-container/40 blur-2xl pointer-events-none" />
                  </div>

                  {/* Hero Air Quality Metric Card */}
                  <div className="lg:col-span-6 rounded-xl bg-surface-container-lowest p-space-md shadow-xs flex flex-col space-y-space-md">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          Live Outdoor Telemetry
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="material-symbols-outlined text-primary text-[18px]">
                            location_on
                          </span>
                          <h2 className="font-title-md text-title-md text-on-surface">
                            {currentStation.stationTitle}
                          </h2>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-container text-on-primary">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        <span className="font-label-sm text-label-sm whitespace-nowrap">
                          AQI {currentStation.aqiStatus}
                        </span>
                      </div>
                    </div>

                    {/* Center Gauge & Value */}
                    <div className="flex flex-col items-center justify-center py-space-xs">
                      <div className="relative w-48 h-28 flex items-end justify-center">
                        <svg className="w-48 h-28" fill="none" viewBox="0 0 192 110">
                          <path
                            d="M 16 98 A 80 80 0 0 1 176 98"
                            stroke="#d1e8dc"
                            strokeLinecap="round"
                            strokeWidth="14"
                          />
                          <path
                            d={getGaugeArcPath(currentStation.aqi)}
                            stroke="#2d6a4f"
                            strokeLinecap="round"
                            strokeWidth="14"
                          />
                        </svg>
                        <div className="absolute bottom-0 flex flex-col items-center text-center">
                          <span className="font-display-hero-mobile text-display-hero-mobile text-primary leading-none tracking-tight tabular-nums">
                            {currentStation.aqi}
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                            AQI US Standard
                          </span>
                        </div>
                      </div>
                      <div className="w-full max-w-xs flex items-center justify-between px-2 pt-1 font-label-sm text-label-sm text-on-surface-variant tabular-nums">
                        <span className="text-primary font-semibold">0 (Clean)</span>
                        <span>50</span>
                        <span>100</span>
                        <span>150</span>
                        <span>300+</span>
                      </div>
                    </div>

                    {/* Sub-stats 4-Cell Grid */}
                    <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
                      <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col justify-between">
                        <div className="flex items-center justify-between text-on-surface-variant">
                          <span className="font-label-sm text-label-sm">PM2.5 Exposure</span>
                          <span className="material-symbols-outlined text-[16px] text-primary">
                            grain
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1 tabular-nums">
                          <span className="font-headline-sm text-headline-sm text-primary">
                            {currentStation.pm25}
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            µg/m³
                          </span>
                        </div>
                        <span className="font-label-sm text-label-sm text-secondary font-semibold mt-0.5">
                          {currentStation.pm25Note}
                        </span>
                      </div>

                      <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col justify-between">
                        <div className="flex items-center justify-between text-on-surface-variant">
                          <span className="font-label-sm text-label-sm">PM10 Coarse</span>
                          <span className="material-symbols-outlined text-[16px] text-tertiary">
                            blur_on
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1 tabular-nums">
                          <span className="font-headline-sm text-headline-sm text-tertiary">
                            {currentStation.pm10}
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            µg/m³
                          </span>
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                          {currentStation.pm10Note}
                        </span>
                      </div>

                      <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col justify-between">
                        <div className="flex items-center justify-between text-on-surface-variant">
                          <span className="font-label-sm text-label-sm">Temperature</span>
                          <span className="material-symbols-outlined text-[16px] text-primary">
                            device_thermostat
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1 tabular-nums">
                          <span className="font-headline-sm text-headline-sm text-on-surface">
                            {tempUnit === 'C'
                              ? `${currentStation.tempC}°C`
                              : `${currentStation.tempF}°F`}
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            /{' '}
                            {tempUnit === 'C'
                              ? `${currentStation.tempF}°F`
                              : `${currentStation.tempC}°C`}
                          </span>
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                          {currentStation.tempNote}
                        </span>
                      </div>

                      <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col justify-between">
                        <div className="flex items-center justify-between text-on-surface-variant">
                          <span className="font-label-sm text-label-sm">Rel. Humidity</span>
                          <span className="material-symbols-outlined text-[16px] text-primary">
                            water_drop
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1 tabular-nums">
                          <span className="font-headline-sm text-headline-sm text-on-surface">
                            {currentStation.humidity}%
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            RH
                          </span>
                        </div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                          {currentStation.humidityNote}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Three Summary Cards */}
                <div className="flex flex-col space-y-space-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-title-md text-title-md text-on-surface">
                      Commute Intelligence
                    </h3>
                    <span className="font-label-sm text-label-sm text-primary md:hidden">
                      Swipe cards →
                    </span>
                  </div>

                  <div className="flex md:grid md:grid-cols-3 gap-space-sm overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
                    <button
                      type="button"
                      onClick={() =>
                        handleNavigate('forecast', 'Viewing hourly dispersion window')
                      }
                      className="text-left snap-start shrink-0 w-64 md:w-auto p-space-sm rounded-xl bg-surface-container-lowest shadow-xs flex flex-col justify-between hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-[20px]">schedule</span>
                        </div>
                        <div>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            Air Status · Open Window
                          </span>
                          <div className="font-label-md text-label-md text-on-surface">
                            Dispersion Forecast
                          </div>
                        </div>
                      </div>
                      <div className="my-space-xs">
                        <p className="font-label-lg text-label-lg text-primary leading-tight">
                          Low Exposure Window until {currentStation.openWindowUntil}
                        </p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                          Ozone and particulate indices rise afterward with evening rush.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-secondary font-label-sm text-label-sm">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        <span>Best time for walking/biking</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleNavigate('hotspots', 'Inspecting active congestion zones')
                      }
                      className="text-left snap-start shrink-0 w-64 md:w-auto p-space-sm rounded-xl bg-surface-container-lowest shadow-xs flex flex-col justify-between hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-error-container flex items-center justify-center text-error">
                          <span className="material-symbols-outlined text-[20px]">
                            crisis_alert
                          </span>
                        </div>
                        <div>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            Sensors Flagged · Live Alerts
                          </span>
                          <div className="font-label-md text-label-md text-on-surface">
                            Corridor Advisories
                          </div>
                        </div>
                      </div>
                      <div className="my-space-xs">
                        <p className="font-label-lg text-label-lg text-error leading-tight tabular-nums">
                          {currentStation.activeCongestionZones} Active Congestion Zones nearby
                        </p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                          Broad Ave &amp; 4th Highway underpass idling traffic peak.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                        <span className="material-symbols-outlined text-[14px]">alt_route</span>
                        <span>Bypass suggested</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleNavigate('route-planner', 'Comparing Greenway route benefits')
                      }
                      className="text-left snap-start shrink-0 w-64 md:w-auto p-space-sm rounded-xl bg-surface-container-lowest shadow-xs flex flex-col justify-between hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center text-on-secondary-container">
                          <span className="material-symbols-outlined text-[20px]">park</span>
                        </div>
                        <div>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            Green Routing · Benefit Est.
                          </span>
                          <div className="font-label-md text-label-md text-on-surface">
                            Canopy Protection
                          </div>
                        </div>
                      </div>
                      <div className="my-space-xs">
                        <p className="font-label-lg text-label-lg text-primary leading-tight tabular-nums">
                          Up to -{currentStation.greenwayReductionPct}% PM2.5 via Greenway route
                        </p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                          Adds only 3 mins travel time through urban park corridor.
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-primary font-label-sm text-label-sm">
                        <span className="material-symbols-outlined text-[14px]">
                          trending_down
                        </span>
                        <span>1.8km tree canopy buffer</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Bottom 2-Column Section: Google Maps Hotspots + AQI Forecast & Trend */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-stretch">
                  <div className="lg:col-span-7 rounded-xl bg-surface-container-lowest p-space-md shadow-xs flex flex-col space-y-space-sm">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-title-md text-title-md text-on-surface">
                          Metro Pollution Hotspots (Google Maps)
                        </h3>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          Live Layer
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Tap filters or map markers to inspect particulate clustering zones across downtown.
                      </p>
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex items-center gap-1.5 pt-0.5" id="hotspotFilters">
                      <button
                        type="button"
                        onClick={() => {
                          setHotspotFilter('all');
                          showHotspotToast(`Filter updated: showing All (${HOTSPOTS.length})`);
                        }}
                        className={`filter-chip px-3 py-1.5 rounded-lg text-label-md font-label-md transition-all cursor-pointer whitespace-nowrap ${
                          hotspotFilter === 'all'
                            ? 'bg-primary-container text-on-primary'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                        }`}
                      >
                        All ({HOTSPOTS.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHotspotFilter('traffic');
                          showHotspotToast(`Filter updated: showing Traffic (${trafficCount})`);
                        }}
                        className={`filter-chip px-3 py-1.5 rounded-lg text-label-md font-label-md transition-all cursor-pointer whitespace-nowrap ${
                          hotspotFilter === 'traffic'
                            ? 'bg-primary-container text-on-primary'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                        }`}
                      >
                        Traffic ({trafficCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHotspotFilter('industrial');
                          showHotspotToast(
                            `Filter updated: showing Industrial (${industrialCount})`
                          );
                        }}
                        className={`filter-chip px-3 py-1.5 rounded-lg text-label-md font-label-md transition-all cursor-pointer whitespace-nowrap ${
                          hotspotFilter === 'industrial'
                            ? 'bg-primary-container text-on-primary'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                        }`}
                      >
                        Industrial ({industrialCount})
                      </button>
                    </div>

                    {/* Interactive Google Map with AdvancedMarkers */}
                    <MetroHotspotsMap
                      hotspots={HOTSPOTS}
                      stations={STATIONS}
                      activeFilter={hotspotFilter}
                      selectedHotspotId={selectedHotspot?.id || null}
                      onSelectHotspot={(spot) => {
                        setSelectedHotspot(spot);
                        showHotspotToast(spot.toastText);
                      }}
                    />

                    {selectedHotspot && (
                      <div className="bg-surface-container-low p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="font-label-md text-label-md text-on-surface flex items-center gap-2">
                            <span>{selectedHotspot.name}</span>
                            <span className="text-on-surface-variant">·</span>
                            <span className="text-error font-semibold tabular-nums">
                              AQI {selectedHotspot.aqi} (PM2.5 {selectedHotspot.pm25} µg/m³)
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            {selectedHotspot.bypassSuggestion}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleNavigate('route-planner', `Bypassing ${selectedHotspot.name}`)
                          }
                          className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm whitespace-nowrap self-start sm:self-center cursor-pointer"
                        >
                          Route Around
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Air Quality Trend Section */}
                  <div className="lg:col-span-5 rounded-xl bg-surface-container-lowest p-space-md shadow-xs flex flex-col justify-between space-y-space-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-title-md text-title-md text-on-surface">
                          AQI Forecast &amp; Trend
                        </h3>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Continuous dispersion projection
                        </p>
                      </div>
                      <div
                        className="flex rounded-lg bg-surface-container p-0.5"
                        id="trendTabGroup"
                      >
                        <button
                          type="button"
                          id="tabHourly"
                          onClick={() => setTrendMode('hourly')}
                          className={`px-2.5 py-1 rounded text-label-sm font-label-sm transition-all cursor-pointer ${
                            trendMode === 'hourly'
                              ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                              : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          Hourly
                        </button>
                        <button
                          type="button"
                          id="tab7Day"
                          onClick={() => setTrendMode('7day')}
                          className={`px-2.5 py-1 rounded text-label-sm font-label-sm transition-all cursor-pointer ${
                            trendMode === '7day'
                              ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                              : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          7-Day
                        </button>
                      </div>
                    </div>

                    {trendMode === 'hourly' ? (
                      <div className="flex flex-col space-y-space-xs pt-space-xs" id="viewHourly">
                        <div className="h-36 w-full flex items-end justify-between gap-2 px-2 pt-4 pb-1.5 bg-surface-container-low rounded-lg tabular-nums">
                          {currentStation.hourlyAqi.map((item) => {
                            const isModerate = item.value > 50;
                            return (
                              <div
                                key={item.time}
                                className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                              >
                                <span
                                  className={`font-label-sm text-label-sm ${
                                    item.isNow
                                      ? 'text-primary font-bold'
                                      : isModerate
                                      ? 'text-tertiary font-semibold'
                                      : 'text-on-surface-variant'
                                  }`}
                                >
                                  {item.value}
                                </span>
                                <div
                                  style={{ height: `${Math.min(95, item.value)}%` }}
                                  className={`w-full max-w-[24px] rounded-t transition-all ${
                                    item.isNow
                                      ? 'bg-primary-container shadow-xs'
                                      : isModerate
                                      ? 'bg-surface-tint'
                                      : 'bg-secondary'
                                  }`}
                                />
                                <span
                                  className={`font-label-sm text-label-sm ${
                                    item.isNow
                                      ? 'text-primary font-bold'
                                      : 'text-on-surface-variant'
                                  }`}
                                >
                                  {item.time}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm px-1">
                          <span>Good (0–50 AQI)</span>
                          <span>Moderate (51–100 AQI)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col space-y-space-xs pt-space-xs" id="view7Day">
                        <div className="h-36 w-full flex items-end justify-between gap-2 px-2 pt-4 pb-1.5 bg-surface-container-low rounded-lg tabular-nums">
                          {currentStation.sevenDayAqi.map((item) => {
                            const isModerate = item.value > 50;
                            return (
                              <div
                                key={item.day}
                                className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                              >
                                <span
                                  className={`font-label-sm text-label-sm ${
                                    item.isToday
                                      ? 'text-primary font-bold'
                                      : isModerate
                                      ? 'text-tertiary font-semibold'
                                      : 'text-on-surface-variant'
                                  }`}
                                >
                                  {item.value}
                                </span>
                                <div
                                  style={{ height: `${Math.min(95, item.value)}%` }}
                                  className={`w-full max-w-[24px] rounded-t transition-all ${
                                    item.isToday
                                      ? 'bg-primary-container shadow-xs'
                                      : isModerate
                                      ? 'bg-surface-tint'
                                      : 'bg-secondary'
                                  }`}
                                />
                                <span
                                  className={`font-label-sm text-label-sm ${
                                    item.isToday
                                      ? 'text-primary font-bold'
                                      : 'text-on-surface-variant'
                                  }`}
                                >
                                  {item.day}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm px-1 tabular-nums">
                          <span>Weekend projected as cleanest overall</span>
                          <span className="text-secondary font-semibold">Avg AQI: 39</span>
                        </div>
                      </div>
                    )}

                    <div className="pt-1 border-t border-surface-container flex items-center justify-between">
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        Best departure: before {currentStation.openWindowUntil}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleNavigate('forecast')}
                        className="font-label-md text-label-md text-primary hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>Full 7-Day Outlook</span>
                        <span className="material-symbols-outlined text-[16px]">
                          chevron_right
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ========================================================= */}
            {/* VIEW 2: ROUTE PLANNER (WITH LIVE GOOGLE MAPS ROUTES API)  */}
            {/* ========================================================= */}
            {activePage === 'route-planner' && (
              <div className="space-y-space-md">
                <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-xs space-y-space-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h1 className="font-headline-md text-headline-md text-primary">
                        Clean Air Route Planner
                      </h1>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Live Google Maps Routes API polyline calculation combined with PM2.5 corridor telemetry.
                      </p>
                    </div>
                    {/* Travel Mode Selector */}
                    <div className="flex rounded-lg bg-surface-container p-1 self-start">
                      {(['bike', 'walk', 'transit'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setTravelMode(mode);
                            void syncUserPreferences({ preferredMode: mode });
                            showHotspotToast(
                              `Updated exposure model for ${mode.toUpperCase()} mode`
                            );
                          }}
                          className={`px-3 py-1.5 rounded-md font-label-md text-label-md capitalize transition-colors cursor-pointer ${
                            travelMode === mode
                              ? 'bg-primary-container text-on-primary'
                              : 'text-on-surface-variant hover:text-on-surface'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Origin & Destination Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm pt-1">
                    <div className="bg-surface-container-low p-2.5 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">
                        my_location
                      </span>
                      <div className="flex-1">
                        <label className="block font-label-sm text-label-sm text-on-surface-variant">
                          Origin Point
                        </label>
                        <input
                          type="text"
                          value={originInput}
                          onChange={(e) => setOriginInput(e.target.value)}
                          className="w-full bg-transparent font-body-md text-body-md text-on-surface focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="bg-surface-container-low p-2.5 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[20px]">
                        flag
                      </span>
                      <div className="flex-1">
                        <label className="block font-label-sm text-label-sm text-on-surface-variant">
                          Destination
                        </label>
                        <input
                          type="text"
                          value={destInput}
                          onChange={(e) => setDestInput(e.target.value)}
                          className="w-full bg-transparent font-body-md text-body-md text-on-surface focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Google Map with Route.computeRoutes Polyline */}
                  <MetroHotspotsMap
                    hotspots={HOTSPOTS}
                    stations={STATIONS}
                    activeFilter="all"
                    selectedHotspotId={selectedHotspot?.id || null}
                    onSelectHotspot={(spot) => {
                      setSelectedHotspot(spot);
                      showHotspotToast(spot.toastText);
                    }}
                    routeOrigin={originInput}
                    routeDestination={destInput}
                    travelMode={travelMode}
                    onRouteCalculated={(stats) => setLiveRouteStats(stats)}
                    heightClass="h-72"
                  />
                </div>

                {/* Route Comparison Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md">
                  {ROUTE_OPTIONS.map((route) => {
                    const isSelected = selectedRouteId === route.id;
                    const modeMultiplier =
                      travelMode === 'walk' ? 1.85 : travelMode === 'transit' ? 0.85 : 1;
                    const adjustedMins =
                      route.recommended && liveRouteStats
                        ? liveRouteStats.durationMins
                        : Math.round(route.durationMins * modeMultiplier);
                    const displayKm =
                      route.recommended && liveRouteStats
                        ? liveRouteStats.distanceKm
                        : route.distanceKm;

                    return (
                      <div
                        key={route.id}
                        onClick={() => setSelectedRouteId(route.id)}
                        className={`rounded-xl p-space-md transition-all cursor-pointer flex flex-col justify-between space-y-space-sm ${
                          isSelected
                            ? 'bg-surface-container-lowest ring-2 ring-primary shadow-sm'
                            : 'bg-surface-container-lowest/80 hover:bg-surface-container-lowest shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-label-sm font-label-sm">
                            <span
                              className={
                                route.recommended
                                  ? 'text-primary font-semibold'
                                  : 'text-on-surface-variant'
                              }
                            >
                              {route.badge}
                            </span>
                            <span className="text-on-surface-variant tabular-nums">
                              {displayKm} km · {adjustedMins} min
                            </span>
                          </div>

                          <h2 className="font-headline-sm text-headline-sm text-on-surface">
                            {route.name}
                          </h2>

                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            {route.description}
                          </p>
                        </div>

                        <div className="space-y-3 pt-2 border-t border-surface-container">
                          <div className="grid grid-cols-3 gap-2 text-center bg-surface-container-low p-2 rounded-lg tabular-nums">
                            <div>
                              <div className="font-label-sm text-label-sm text-on-surface-variant">
                                Avg AQI
                              </div>
                              <div
                                className={`font-headline-sm text-headline-sm ${
                                  route.avgAqi <= 50 ? 'text-primary' : 'text-error'
                                }`}
                              >
                                {route.avgAqi}
                              </div>
                            </div>
                            <div>
                              <div className="font-label-sm text-label-sm text-on-surface-variant">
                                PM2.5
                              </div>
                              <div className="font-headline-sm text-headline-sm text-on-surface">
                                {route.pm25Exposure}
                              </div>
                            </div>
                            <div>
                              <div className="font-label-sm text-label-sm text-on-surface-variant">
                                Canopy
                              </div>
                              <div className="font-headline-sm text-headline-sm text-secondary">
                                {route.treeCanopyKm}km
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="font-label-sm text-label-sm text-on-surface-variant">
                              Corridor Waypoints:
                            </div>
                            <div className="font-body-sm text-body-sm text-on-surface">
                              {route.waypoints.join(' → ')}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveNavigationRoute(route);
                                showHotspotToast(
                                  `Started clean-air turn-by-turn guidance on ${route.name}`
                                );
                              }}
                              className={`flex-1 py-2.5 px-3 rounded-lg font-label-lg text-label-lg transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-primary-container text-on-primary'
                                  : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                              }`}
                            >
                              {activeNavigationRoute?.id === route.id
                                ? 'Active Route'
                                : 'Start Route'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleBookmarkRoute(route);
                              }}
                              aria-label="Bookmark route"
                              className="px-3 py-2.5 rounded-lg bg-surface-container-high text-primary hover:bg-surface-container-highest transition-colors cursor-pointer flex items-center justify-center"
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                bookmark_add
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Saved Commuter Routes (Synced via Firestore) */}
                <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-xs space-y-space-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-title-md text-title-md text-on-surface">
                        Your Bookmarked Clean-Air Routes
                      </h2>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {currentUser
                          ? `Synced to ${currentUser.email}`
                          : 'Log in with Google to save and sync routes across devices.'}
                      </p>
                    </div>
                    {!currentUser && (
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md cursor-pointer"
                      >
                        Log In
                      </button>
                    )}
                  </div>

                  {currentUser && savedRoutes.length === 0 && (
                    <div className="p-space-sm rounded-lg bg-surface-container-low text-body-sm text-on-surface-variant">
                      No bookmarked routes yet. Tap the bookmark icon on any route card above to save it.
                    </div>
                  )}

                  {currentUser && savedRoutes.length > 0 && (
                    <div className="divide-y divide-surface-container">
                      {savedRoutes.map((sr) => (
                        <div
                          key={sr.id}
                          className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-label-lg text-label-lg text-on-surface">
                              {sr.name}{' '}
                              <span className="text-on-surface-variant font-normal">
                                ({sr.travelMode})
                              </span>
                            </div>
                            <div className="font-body-sm text-body-sm text-on-surface-variant">
                              {sr.origin} → {sr.destination} · AQI {sr.avgAqi} · PM2.5{' '}
                              {sr.pm25Exposure} µg/m³
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => {
                                setOriginInput(sr.origin);
                                setDestInput(sr.destination);
                                setTravelMode(sr.travelMode);
                                showHotspotToast(`Loaded saved route: ${sr.name}`);
                              }}
                              className="px-2.5 py-1 rounded bg-surface-container-high text-primary font-label-sm text-label-sm cursor-pointer"
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteSavedRoute(sr.id)}
                              className="px-2.5 py-1 rounded bg-error-container text-on-error-container font-label-sm text-label-sm cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active Turn-by-Turn Guidance Banner */}
                {activeNavigationRoute && (
                  <div className="rounded-xl bg-primary-container text-on-primary p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-label-sm text-label-sm text-secondary-fixed">
                        Active Clean-Air Navigation · {travelMode.toUpperCase()}
                      </div>
                      <div className="font-headline-sm text-headline-sm">
                        {activeNavigationRoute.name} ({activeNavigationRoute.pm25DeltaPct}% PM2.5
                        vs Arterial)
                      </div>
                      <p className="font-body-sm text-body-sm text-on-primary-container">
                        Next step: Follow {activeNavigationRoute.waypoints[1]} toward{' '}
                        {destInput}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveNavigationRoute(null);
                        showHotspotToast('Ended active route guidance');
                      }}
                      className="px-4 py-2 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md self-start sm:self-center cursor-pointer whitespace-nowrap"
                    >
                      End Guidance
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 3: AIR QUALITY TELEMETRY                             */}
            {/* ========================================================= */}
            {activePage === 'air-quality' && (
              <div className="space-y-space-md">
                <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-xs space-y-space-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h1 className="font-headline-md text-headline-md text-primary">
                        Multi-Pollutant Air Quality Telemetry
                      </h1>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Station breakdown across downtown micro-climate corridors.
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {STATIONS.map((st, idx) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSelectStation(idx)}
                          className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm transition-colors cursor-pointer ${
                            stationIndex === idx
                              ? 'bg-primary-container text-on-primary'
                              : 'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          #{idx + 1} {st.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm pt-2 tabular-nums">
                    <div className="p-space-sm rounded-lg bg-surface-container-low space-y-1">
                      <div className="font-label-sm text-label-sm text-on-surface-variant">
                        Fine Particulate (PM2.5)
                      </div>
                      <div className="font-code-metric text-code-metric text-primary">
                        {currentStation.pm25}{' '}
                        <span className="text-label-sm font-label-sm">µg/m³</span>
                      </div>
                      <div className="font-body-sm text-body-sm text-secondary">
                        WHO 24h target: 15.0 µg/m³
                      </div>
                    </div>

                    <div className="p-space-sm rounded-lg bg-surface-container-low space-y-1">
                      <div className="font-label-sm text-label-sm text-on-surface-variant">
                        Coarse Dust (PM10)
                      </div>
                      <div className="font-code-metric text-code-metric text-tertiary">
                        {currentStation.pm10}{' '}
                        <span className="text-label-sm font-label-sm">µg/m³</span>
                      </div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        WHO 24h target: 45.0 µg/m³
                      </div>
                    </div>

                    <div className="p-space-sm rounded-lg bg-surface-container-low space-y-1">
                      <div className="font-label-sm text-label-sm text-on-surface-variant">
                        Nitrogen Dioxide (NO₂)
                      </div>
                      <div className="font-code-metric text-code-metric text-on-surface">
                        {currentStation.no2}{' '}
                        <span className="text-label-sm font-label-sm">ppb</span>
                      </div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        Traffic exhaust indicator
                      </div>
                    </div>

                    <div className="p-space-sm rounded-lg bg-surface-container-low space-y-1">
                      <div className="font-label-sm text-label-sm text-on-surface-variant">
                        Ground-Level Ozone (O₃)
                      </div>
                      <div className="font-code-metric text-code-metric text-on-surface">
                        {currentStation.o3}{' '}
                        <span className="text-label-sm font-label-sm">ppb</span>
                      </div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        Photochemical afternoon level
                      </div>
                    </div>
                  </div>
                </div>

                {/* All Stations Comparison Table */}
                <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-xs space-y-space-sm">
                  <h2 className="font-title-md text-title-md text-on-surface">
                    Metro Monitoring Network Comparison
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse tabular-nums">
                      <thead>
                        <tr className="border-b border-surface-container text-on-surface-variant font-label-sm text-label-sm">
                          <th className="py-2.5 pr-4">Station Corridor</th>
                          <th className="py-2.5 px-3">US AQI</th>
                          <th className="py-2.5 px-3">PM2.5 (µg/m³)</th>
                          <th className="py-2.5 px-3">PM10 (µg/m³)</th>
                          <th className="py-2.5 px-3">NO₂ (ppb)</th>
                          <th className="py-2.5 pl-3">Open Window</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container font-body-md text-body-md">
                        {STATIONS.map((st, idx) => (
                          <tr
                            key={st.id}
                            onClick={() => handleSelectStation(idx)}
                            className={`cursor-pointer hover:bg-surface-container-low transition-colors ${
                              idx === stationIndex ? 'bg-surface-container-low/70 font-semibold' : ''
                            }`}
                          >
                            <td className="py-3 pr-4">
                              <div className="text-on-surface">{st.name}</div>
                              <div className="font-body-sm text-body-sm text-on-surface-variant">
                                {st.stationTitle}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-primary font-semibold">
                              {st.aqi} ({st.aqiStatus})
                            </td>
                            <td className="py-3 px-3">{st.pm25}</td>
                            <td className="py-3 px-3">{st.pm10}</td>
                            <td className="py-3 px-3">{st.no2}</td>
                            <td className="py-3 pl-3 text-secondary">
                              Until {st.openWindowUntil}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 4: HOTSPOTS DIRECTORY & MAP                          */}
            {/* ========================================================= */}
            {activePage === 'hotspots' && (
              <div className="space-y-space-md">
                <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-xs space-y-space-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h1 className="font-headline-md text-headline-md text-primary">
                        Metro Pollution Hotspots ({filteredHotspots.length})
                      </h1>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Real-time clustering of traffic portals and industrial freight emissions on Google Maps.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['all', 'traffic', 'industrial'] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setHotspotFilter(filter)}
                          className={`px-3 py-1.5 rounded-lg font-label-md text-label-md capitalize transition-colors cursor-pointer ${
                            hotspotFilter === filter
                              ? 'bg-primary-container text-on-primary'
                              : 'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>

                  <MetroHotspotsMap
                    hotspots={HOTSPOTS}
                    stations={STATIONS}
                    activeFilter={hotspotFilter}
                    selectedHotspotId={selectedHotspot?.id || null}
                    onSelectHotspot={(spot) => {
                      setSelectedHotspot(spot);
                      showHotspotToast(spot.toastText);
                    }}
                    heightClass="h-80"
                  />
                </div>

                {/* Detailed List of All Filtered Hotspots */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                  {filteredHotspots.map((spot) => (
                    <div
                      key={spot.id}
                      onClick={() => {
                        setSelectedHotspot(spot);
                        showHotspotToast(spot.toastText);
                      }}
                      className={`rounded-xl bg-surface-container-lowest p-space-md shadow-xs space-y-2 cursor-pointer transition-all ${
                        selectedHotspot?.id === spot.id ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-label-sm text-label-sm text-on-surface-variant capitalize">
                            {spot.category} Source · {spot.trend}
                          </span>
                          <h3 className="font-title-md text-title-md text-on-surface">
                            {spot.name}
                          </h3>
                        </div>
                        <span className="font-code-metric text-headline-sm text-error tabular-nums">
                          AQI {spot.aqi}
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {spot.cause}
                      </p>
                      <div className="pt-1 flex items-center justify-between text-label-sm font-label-sm text-primary border-t border-surface-container tabular-nums">
                        <span>
                          PM2.5: {spot.pm25} µg/m³ · PM10: {spot.pm10} µg/m³
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigate('route-planner', `Bypassing ${spot.name}`);
                          }}
                          className="underline cursor-pointer"
                        >
                          Bypass Route →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 5: FORECAST                                          */}
            {/* ========================================================= */}
            {activePage === 'forecast' && (
              <div className="space-y-space-md">
                <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-xs space-y-space-md">
                  <div>
                    <h1 className="font-headline-md text-headline-md text-primary">
                      Dispersion &amp; Commute Window Forecast
                    </h1>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Plan morning and evening departures around boundary-layer ventilation and traffic peaks.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
                    <div className="p-space-sm rounded-lg bg-surface-container-low space-y-1">
                      <div className="font-label-sm text-label-sm text-secondary">
                        Optimal Departure Window
                      </div>
                      <div className="font-headline-sm text-headline-sm text-primary tabular-nums">
                        Now – {currentStation.openWindowUntil}
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Sea breeze mixing keeps PM2.5 below 10 µg/m³ along Greenway corridors.
                      </p>
                    </div>

                    <div className="p-space-sm rounded-lg bg-surface-container-low space-y-1">
                      <div className="font-label-sm text-label-sm text-error">
                        Evening Rush Peak
                      </div>
                      <div className="font-headline-sm text-headline-sm text-on-surface tabular-nums">
                        5:00 PM – 6:45 PM
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        AQI rises to 68–74 near arterial underpasses. Protected park routes strongly advised.
                      </p>
                    </div>

                    <div className="p-space-sm rounded-lg bg-surface-container-low space-y-1">
                      <div className="font-label-sm text-label-sm text-primary">
                        Weekend Outlook
                      </div>
                      <div className="font-headline-sm text-headline-sm text-primary tabular-nums">
                        Sat AQI 29 · Sun AQI 31
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Reduced freight diesel activity yields cleanest 48-hour outdoor window of the week.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <h2 className="font-title-md text-title-md text-on-surface">
                      7-Day Corridor Projection ({currentStation.name})
                    </h2>
                    <div className="divide-y divide-surface-container tabular-nums">
                      {currentStation.sevenDayAqi.map((dayItem) => (
                        <div
                          key={dayItem.day}
                          className="py-2.5 flex items-center justify-between gap-4"
                        >
                          <span
                            className={`w-20 font-label-md text-label-md ${
                              dayItem.isToday ? 'text-primary font-bold' : 'text-on-surface'
                            }`}
                          >
                            {dayItem.day}
                          </span>
                          <div className="flex-1 h-2.5 bg-surface-container-low rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, dayItem.value)}%` }}
                              className={`h-full rounded-full ${
                                dayItem.value <= 50 ? 'bg-secondary' : 'bg-surface-tint'
                              }`}
                            />
                          </div>
                          <span className="w-24 text-right font-label-md text-label-md text-on-surface">
                            AQI {dayItem.value} ({dayItem.value <= 50 ? 'Good' : 'Moderate'})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 6: HEALTH GUIDANCE                                   */}
            {/* ========================================================= */}
            {activePage === 'health-guidance' && (
              <div className="space-y-space-md">
                <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-xs space-y-space-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h1 className="font-headline-md text-headline-md text-primary">
                        Commuter Respiratory Guidance
                      </h1>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Actionable exposure thresholds based on US AQI and fine particulate concentrations.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !sensitiveGroupMode;
                        setSensitiveGroupMode(nextVal);
                        void syncUserPreferences({ sensitiveGroupMode: nextVal });
                        showHotspotToast(
                          nextVal
                            ? 'Enabled Sensitive Respiratory Profile (Asthma / Allergies)'
                            : 'Switched to Standard Adult Commuter Profile'
                        );
                      }}
                      className={`px-3.5 py-2 rounded-lg font-label-md text-label-md cursor-pointer transition-colors ${
                        sensitiveGroupMode
                          ? 'bg-primary-container text-on-primary'
                          : 'bg-surface-container-high text-on-surface'
                      }`}
                    >
                      {sensitiveGroupMode
                        ? 'Profile: Sensitive Respiratory Group'
                        : 'Enable Sensitive Group Thresholds'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
                    <div className="p-space-md rounded-xl bg-surface-container-low space-y-1.5">
                      <div className="font-label-md text-label-md text-secondary">
                        0–50 AQI · Good
                      </div>
                      <h3 className="font-title-md text-title-md text-on-surface">
                        Ideal for Active Commuting
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Optimal conditions for cycling, running, and walking. Ventilation rate increases do not carry excess PM2.5 burden.
                      </p>
                    </div>

                    <div className="p-space-md rounded-xl bg-surface-container-low space-y-1.5">
                      <div className="font-label-md text-label-md text-tertiary">
                        51–100 AQI · Moderate
                      </div>
                      <h3 className="font-title-md text-title-md text-on-surface">
                        Prefer Tree-Buffered Streets
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {sensitiveGroupMode
                          ? 'Sensitive profile active: Avoid arterial tunnels and reduce high-exertion hill climbs near diesel corridors.'
                          : 'Unusually sensitive commuters should bypass highway underpasses using the Emerald Greenway.'}
                      </p>
                    </div>

                    <div className="p-space-md rounded-xl bg-surface-container-low space-y-1.5">
                      <div className="font-label-md text-label-md text-error">
                        101+ AQI · Elevated
                      </div>
                      <h3 className="font-title-md text-title-md text-on-surface">
                        Filtered Transit or FFP2/N95
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Shift from vigorous cycling to enclosed rail transit or wear a fitted particulate respirator when crossing industrial zones.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 7: ABOUT ECOROUTE                                    */}
            {/* ========================================================= */}
            {activePage === 'about-ecoroute' && (
              <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-xs space-y-space-md">
                <div>
                  <h1 className="font-headline-md text-headline-md text-primary">
                    About EcoRoute Telemetry
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-2xl">
                    EcoRoute combines street-level particulate dispersion models, urban tree canopy buffers, and Google Maps Platform routing to help commuters reduce inhaled PM2.5 and NO₂ doses without sacrificing travel speed.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
                  <div className="p-space-md rounded-lg bg-surface-container-low space-y-1">
                    <h2 className="font-title-md text-title-md text-on-surface">
                      Inhaled Dose vs. Ambient Concentration
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Cyclists and pedestrians breathe 2.5x to 4x more air volume per minute than car passengers. Separating bikeways by even 80 meters from arterial diesel corridors cuts ultrafine particulate exposure by 35–50%.
                    </p>
                  </div>
                  <div className="p-space-md rounded-lg bg-surface-container-low space-y-1">
                    <h2 className="font-title-md text-title-md text-on-surface">
                      Demo Dataset Transparency
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      All station readings, pollution hotspots, and dispersion projections in this preview represent a calibrated urban micro-climate simulation for Downtown Central.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW 8: SETTINGS                                          */}
            {/* ========================================================= */}
            {activePage === 'settings' && (
              <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-xs space-y-space-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h1 className="font-headline-md text-headline-md text-primary">
                      Commuter &amp; Telemetry Settings
                    </h1>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Customize measurement units, alert thresholds, and cloud profile sync.
                    </p>
                  </div>
                  {currentUser ? (
                    <div className="flex items-center gap-2">
                      <span className="font-label-sm text-label-sm text-secondary">
                        Cloud Sync Active ({currentUser.email})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleNavigate('auth')}
                        className="px-2.5 py-1 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm cursor-pointer"
                      >
                        Manage Account
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleNavigate('auth')}
                      className="px-3.5 py-2 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md cursor-pointer self-start shadow-xs"
                    >
                      Log In or Register to Sync
                    </button>
                  )}
                </div>

                <div className="divide-y divide-surface-container space-y-3">
                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      <div className="font-label-lg text-label-lg text-on-surface">
                        Temperature Unit
                      </div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        Primary unit shown on outdoor station cards
                      </div>
                    </div>
                    <div className="flex rounded-lg bg-surface-container p-1">
                      {(['C', 'F'] as const).map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => {
                            setTempUnit(unit);
                            void syncUserPreferences({ tempUnit: unit });
                            showHotspotToast(`Primary temperature unit set to °${unit}`);
                          }}
                          className={`px-3 py-1 rounded font-label-md text-label-md cursor-pointer ${
                            tempUnit === unit
                              ? 'bg-primary-container text-on-primary'
                              : 'text-on-surface-variant'
                          }`}
                        >
                          °{unit}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between">
                    <div>
                      <div className="font-label-lg text-label-lg text-on-surface">
                        AQI Congestion Alert Threshold
                      </div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        Trigger automatic bypass suggestions above AQI {aqiAlertThreshold}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={100}
                      step={5}
                      value={aqiAlertThreshold}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setAqiAlertThreshold(val);
                        void syncUserPreferences({ aqiAlertThreshold: val });
                      }}
                      className="w-36 accent-primary cursor-pointer"
                    />
                  </div>

                  <div className="pt-3 flex items-center justify-between">
                    <div>
                      <div className="font-label-lg text-label-lg text-on-surface">
                        Low-Exposure Departure Window Reminder
                      </div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        Notify 30 minutes before afternoon particulate rise
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !commuteReminder;
                        setCommuteReminder(nextVal);
                        void syncUserPreferences({ commuteReminder: nextVal });
                        showHotspotToast(
                          nextVal
                            ? 'Departure window notifications enabled'
                            : 'Departure window notifications muted'
                        );
                      }}
                      className={`px-3.5 py-1.5 rounded-lg font-label-md text-label-md cursor-pointer ${
                        commuteReminder
                          ? 'bg-primary-container text-on-primary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {commuteReminder ? 'Enabled' : 'Muted'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Toast Notification Container */}
            <div
              id="dashboardToast"
              className={`fixed top-20 inset-x-4 z-50 transform transition-all duration-200 flex justify-center ${
                toastMessage
                  ? 'translate-y-0 opacity-100'
                  : '-translate-y-16 opacity-0 pointer-events-none'
              }`}
            >
              <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 max-w-sm">
                <span className="material-symbols-outlined text-secondary-fixed text-[20px]">
                  info
                </span>
                <span className="font-body-sm text-body-sm" id="toastMsg">
                  {toastMessage || 'Notification details'}
                </span>
              </div>
            </div>
          </div>
        </main>

        {/* Fixed Bottom Tab Bar */}
        <nav
          className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface-container-lowest/85 backdrop-blur-xl shadow-[0_-1px_12px_rgba(8,28,21,0.04)] border-t border-surface-container"
          data-active-classes="text-primary font-semibold"
        >
          <div className="max-w-xl mx-auto flex justify-around items-center h-16 px-space-xs">
            {bottomTabs.map((tab) => {
              const isActive = activePage === tab.path;
              return (
                <button
                  key={tab.path}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleNavigate(tab.path)}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[60px] h-11 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-primary font-semibold'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
                  <span className="font-label-sm text-label-sm whitespace-nowrap">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </APIProvider>
  );
}
