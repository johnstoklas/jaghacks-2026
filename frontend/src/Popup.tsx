import { useState } from "react";
import HomePage from "./pages/homePage";
import ScraperPage from "./pages/scraperPage";

export default function Popup() {
  const [page, setPage] = useState<"home" | "scraper">("home");
  
  return (
    <div className="w-[380px] max-w-md h-[600px] text-center p-6 flex flex-col relative">
      {page === "home" && <HomePage 
        setPage={setPage}
      />}
      {page === "scraper" && <ScraperPage />}
    </div>
  );
}