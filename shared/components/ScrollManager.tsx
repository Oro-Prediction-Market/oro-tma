import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Scroll position per history entry, so Back can return to it. */
const saved = new Map<string, number>();

/**
 * Drop inside the router. Opening a page starts it at the top; going Back
 * returns to where that page was left.
 *
 * Without it the window keeps its scroll offset across pages: open the EPL
 * hub from halfway down the feed and the hub opens halfway down too.
 */
export function ScrollManager() {
  const { key, pathname } = useLocation();
  const navType = useNavigationType();
  const current = useRef({ key, pathname });

  useEffect(() => {
    // The browser's own restoration fires before the page has re-rendered,
    // and then fights this one.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const onScroll = () => saved.set(current.current.key, window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const prev = current.current;
    current.current = { key, pathname };
    // Same page, new query or hash (a filter, a tab): leave it where it is.
    if (prev.pathname === pathname) return;

    const y = navType === "POP" ? saved.get(key) : undefined;
    if (y === undefined) {
      window.scrollTo(0, 0);
      return;
    }
    // The page may still be loading its content, too short to reach `y` yet.
    // Keep trying for about a second rather than landing short of it.
    let frames = 0;
    let raf = 0;
    const attempt = () => {
      window.scrollTo(0, y);
      if (Math.abs(window.scrollY - y) > 2 && frames++ < 60) {
        raf = requestAnimationFrame(attempt);
      }
    };
    attempt();
    return () => cancelAnimationFrame(raf);
  }, [key, pathname, navType]);

  return null;
}
