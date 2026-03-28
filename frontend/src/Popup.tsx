import { useEffect, useState } from "react";

export default function Popup() {
  const [onReels, setOnReels] = useState(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url: string = tabs[0]?.url || "";
      console.log(url)
      if (url.includes("instagram.com/reels")) {
        setOnReels(true);
      }
    });
  }, []);

  const handleClick = () => {
    if (onReels) {
      console.log("Begin scraping / logic here");
    } else {
      chrome.tabs.create({
        url: "https://www.instagram.com/reels/",
      });
    }
  };
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-white px-6 py-10">
      
      <div className="w-full max-w-md text-center backdrop-blur-xl bg-white/70 border border-blue-100 rounded-3xl shadow-xl p-6">
        
        {/* Title */}
        <h1 className="text-4xl font-bold text-blue-600 mb-8 tracking-tight">
          ReelDaddy
        </h1>

        {/* Text Area */}
        <textarea
          placeholder="Describe what you want..."
          className="
            w-full h-40 p-4
            rounded-2xl
            bg-white/80
            border border-blue-200
            focus:border-blue-500
            focus:ring-2 focus:ring-blue-200
            outline-none
            resize-none
            transition-all
            focus:scale-[1.02]
          "
        />

        {/* Button */}
        <button
          onClick={handleClick}
          className="
            mt-6 w-full py-4
            rounded-2xl
            bg-blue-500 text-white
            text-lg font-semibold
            hover:bg-blue-600
            active:scale-95
            transition-all
            shadow-md hover:shadow-blue-200
          "
        >
          {onReels ? "Begin" : "Open Instagram"}
        </button>

      </div>
    </div>
  );
}