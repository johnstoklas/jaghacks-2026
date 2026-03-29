import { useEffect, useState } from "react";
import HomePage from "./pages/homePage";
import ScraperPage from "./pages/scraperPage";

export default function Popup() {
  const [page, setPage] = useState<"home" | "scraper">("home");
  const [activeTabUrl, setActiveTabUrl] = useState("");

  useEffect(() => {
    const syncActiveTabUrl = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        setActiveTabUrl(tabs[0]?.url || "");
      });
    };

    syncActiveTabUrl();

    const handleActivated = () => {
      syncActiveTabUrl();
    };

    const handleUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      _tabId,
      changeInfo,
      tab
    ) => {
      if (!tab.active) return;
      if (typeof changeInfo.url === "string") {
        setActiveTabUrl(changeInfo.url);
        return;
      }
      if (changeInfo.status === "complete") {
        setActiveTabUrl(tab.url || "");
      }
    };

    const handleWindowFocus = () => {
      syncActiveTabUrl();
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.windows.onFocusChanged.addListener(handleWindowFocus);

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.windows.onFocusChanged.removeListener(handleWindowFocus);
    };
  }, []);
  
  return (
    <div className="w-[380px] max-w-md h-[600px] text-center p-6 flex flex-col relative">
      {page === "home" && <HomePage 
        setPage={setPage}
        activeTabUrl={activeTabUrl}
      />}
      {page === "scraper" && <ScraperPage />}
    </div>
  );
} 