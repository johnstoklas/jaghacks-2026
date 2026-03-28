import { useState } from "react";
import HomePage from "./pages/homePage";
import ScraperPage from "./pages/scraperPage";

export default function Popup() {
  const [page, setPage] = useState<"home" | "scraper">("home");
  
  return (
    <div className="w-[380px] max-w-md h-[600px] text-center backdrop-blur-xl bg-white/70 border border-blue-100 rounded-3xl shadow-xl p-6 flex flex-col">
      {page === "home" && <HomePage 
        setPage={setPage}
      />}
      {page === "scraper" && <ScraperPage />}
    </div>
  );
}