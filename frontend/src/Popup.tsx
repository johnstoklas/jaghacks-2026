import { useState } from "react";
import HomePage from "./pages/homePage";
import PlaylistsPage from "./pages/playlistsPage";
import ScraperPage from "./pages/scraperPage";
import type { PopupPage } from "./types/popup";

export default function Popup() {
  const [page, setPage] = useState<PopupPage>("home");

  return (
    <div className="w-[380px] max-w-md h-[600px] text-center p-6 flex flex-col relative">
      {page !== "scraper" && (
        <div className="flex w-full gap-2 mb-4 shrink-0">
          <button
            type="button"
            onClick={() => setPage("home")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
              page === "home"
                ? "border-pink-400 bg-pink-50 text-pink-700 shadow-sm"
                : "border-pink-100 bg-white/70 text-gray-600 hover:bg-pink-50/50"
            }`}
          >
            Topics
          </button>
          <button
            type="button"
            onClick={() => setPage("playlists")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
              page === "playlists"
                ? "border-pink-400 bg-pink-50 text-pink-700 shadow-sm"
                : "border-pink-100 bg-white/70 text-gray-600 hover:bg-pink-50/50"
            }`}
          >
            Playlists
          </button>
        </div>
      )}

      {page === "home" && <HomePage setPage={setPage} />}
      {page === "playlists" && <PlaylistsPage />}
      {page === "scraper" && <ScraperPage />}
    </div>
  );
}