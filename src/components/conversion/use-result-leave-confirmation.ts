"use client";

import { useEffect } from "react";

type ResultNavigateEvent = Event & { navigationType: string; destination: { sameDocument: boolean; url: string } };

export function useResultLeaveConfirmation(enabled: boolean, message: string): void {
  useEffect(() => {
    if (!enabled) return;

    function confirmLink(event: MouseEvent): void {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const destination = new URL(link.href);
      // Full navigations to other sites are covered by the browser's beforeunload dialog.
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;

      // Capture before React handlers can clear the result, including “convert again”.
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    function confirmUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = "";
    }

    function confirmHistory(event: Event): void {
      const navigationEvent = event as ResultNavigateEvent;
      if (!event.cancelable || navigationEvent.navigationType !== "traverse" || !navigationEvent.destination.sameDocument) return;
      const destination = new URL(navigationEvent.destination.url);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (!window.confirm(message)) event.preventDefault();
    }

    // Navigation API cancels back/forward before Next.js changes the page, without adding history entries.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    document.addEventListener("click", confirmLink, true);
    window.addEventListener("beforeunload", confirmUnload);
    navigation?.addEventListener("navigate", confirmHistory);

    return () => {
      document.removeEventListener("click", confirmLink, true);
      window.removeEventListener("beforeunload", confirmUnload);
      navigation?.removeEventListener("navigate", confirmHistory);
    };
  }, [enabled, message]);
}
