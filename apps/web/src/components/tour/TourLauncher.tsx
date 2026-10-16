"use client";

import { useEffect, useState } from "react";
import { AppTour, wasTourSeen } from "@/components/tour/AppTour";
import { useFirebase } from "@/components/providers/FirebaseProvider";

export const OPEN_TOUR_EVENT = "open-app-tour";

/** Opens the tour automatically for first-timers, and on demand from
 *  anywhere via `window.dispatchEvent(new Event(OPEN_TOUR_EVENT))`. */
export function TourLauncher() {
  const { ready } = useFirebase();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready || wasTourSeen()) return;
    const timer = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    const openTour = () => setOpen(true);
    window.addEventListener(OPEN_TOUR_EVENT, openTour);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, openTour);
  }, []);

  return <AppTour open={open} onClose={() => setOpen(false)} />;
}
