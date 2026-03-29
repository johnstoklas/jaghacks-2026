import { useEffect, useState } from "react";
import Alert from "../component/alert";
import { sendToBackground } from "../utils";

interface HomePageInterface {
  setPage: React.Dispatch<React.SetStateAction<"home" | "scraper">>;
  activeTabUrl: string;
}

const HomePage = ({ setPage, activeTabUrl }: HomePageInterface) => {
  const [onReels, setOnReels] = useState(false);
  const [items, setItems] = useState<string[]>([""]);
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    setOnReels(activeTabUrl.includes("instagram.com/reels"));
  }, [activeTabUrl]);

  const handleItemChange = (index: number, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleAdd = () => {
    if(!onReels) {
      setAlert("Please open Instagram first.");
      return;
    }
    setItems((prev) => [...prev, ""]);
  };

  const handleRemove = (index: number) => {
    if (index === 0) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClick = async () => {
    if (onReels) {
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

      <h1
        className="
          text-4xl font-bold mb-6 tracking-tight shrink-0
          bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]
          bg-clip-text text-transparent
        "
      >
        ReelDaddy
      </h1>

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
                onClick={() => handleRemove(index)}
                disabled={index === 0}
                className={`
                  px-4 py-3 rounded-2xl text-sm font-semibold transition-all
                  ${
                    index === 0
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-red-100 text-red-600 hover:bg-red-200 active:scale-95"
                  }
                `}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleAdd}
          className="
            mt-4 w-full py-3
            rounded-2xl
            bg-white border border-pink-200 text-pink-500
            text-base font-semibold
            hover:bg-pink-50
            active:scale-95
            transition-all
            shadow-sm
            shrink-0
          "
        >
          Add
        </button>
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
        {onReels ? "Begin" : "Open Instagram"}
      </button>
    </>
  );
};

export default HomePage;