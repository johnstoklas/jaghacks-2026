import { useEffect, useState } from "react";
import Alert from "../component/alert";
import { sendToBackground } from "../utils";
import type { PopupPage } from "../types/popup";

interface HomePageInterface {
  setPage: React.Dispatch<React.SetStateAction<PopupPage>>;
}

const HomePage = ({ setPage }: HomePageInterface) => {
  const [onInstagram, setOnInstagram] = useState(false);
  const [items, setItems] = useState<string[]>([""]);
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url: string = tabs[0]?.url || "";
      console.log(url);
      if (url.includes("instagram.com")) {
        setOnInstagram(true);
      }
    });
  }, []);

  const handleItemChange = (index: number, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleAdd = () => {
    if(!onInstagram) {
      setAlert("Please open Instagram first.");
      return;
    }
    setItems((prev) => [...prev, ""]);
  };

  const handleRemove = (index: number) => {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleClick = async () => {
    if (onInstagram) {
      const cleanedItems = items
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (cleanedItems.length === 0) {
        setAlert("Please add at least one topic before starting.");
        return;
      }

      try {
        const response = await sendToBackground("createRun", {
          items: cleanedItems,
        });

        console.log("Background response:", response);
        setPage("scraper");
      } catch (err) {
        console.error("Failed to send message:", err);
        setAlert("Something went wrong starting the scraper.");
      }
    } else {
      chrome.tabs.create({ url: "https://www.instagram.com/reels/" });
    }
  };

  return (
    <>
      {alert && <Alert message={alert} onClose={() => setAlert(null)} />}

    <div className="flex w-full flex-col items-start text-left">
      <h1
        className="
          text-4xl font-bold mb-6 tracking-tight shrink-0
          bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]
          bg-clip-text text-transparent
        "
      >
        ReelDaddy
      </h1>

      <p className="text-sm text-gray-500 mb-4">
        Add topics you want to see more of on Instagram Reels.
        We will use these topics to personalize your Instagram Reels feed.
      </p>
    </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="text"
                value={item}
                onChange={(e) => handleItemChange(index, e.target.value)}
                placeholder="Add an item..."
                className="
                  flex-1 p-3
                  rounded-2xl
                  bg-white/80
                  border border-pink-200
                  focus:border-pink-400
                  focus:ring-2 focus:ring-pink-200
                  outline-none
                  transition-all
                "
              />

              <button
                onClick={index === items.length - 1 ? handleAdd : () => handleRemove(index)}
                className={`
                  px-4 py-3 rounded-2xl text-sm font-semibold transition-all
                  ${
                    index === items.length - 1
                      ? "bg-white border border-pink-200 text-pink-500 hover:bg-pink-50 active:scale-95"
                      : "bg-red-100 text-red-600 hover:bg-red-200 active:scale-95"
                  }
                `}
              >
                {index === items.length - 1 ? "Add" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleClick}
        className="
          mt-6 w-full py-4
          rounded-2xl
          bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]
          text-white
          text-lg font-semibold
          hover:opacity-90
          active:scale-95
          transition-all
          shadow-md hover:shadow-pink-200
          shrink-0
        "
      >
        {onInstagram ? "Begin Scrolling" : "Open Instagram"}
      </button>
    </>
  );
};

export default HomePage;