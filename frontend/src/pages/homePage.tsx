import { useEffect, useState } from "react";
import Alert from "../component/alert";

interface HomePageInterface {
    setPage: React.Dispatch<React.SetStateAction<"home" | "scraper">>;
}

const HomePage = ({ setPage }: HomePageInterface) => {
    const [onReels, setOnReels] = useState(false);
    const [items, setItems] = useState<string[]>([""]);
    const [alert, setAlert] = useState<string | null>(null);

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url: string = tabs[0]?.url || "";
        console.log(url);
        if (url.includes("instagram.com/reels")) {
            setOnReels(true);
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
        setItems((prev) => [...prev, ""]);
    };

    const handleRemove = (index: number) => {
        if (index === 0) return;
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const handleClick = () => {
        if (onReels) {
            // Trim + remove empty items
            const cleanedItems = items
                .map((item) => item.trim())
                .filter((item) => item.length > 0);

            // ❌ If nothing valid
            if (cleanedItems.length === 0) {
                setAlert("Please add at least one topic before starting.");
                return;
            }
            console.log("Begin scraping / logic here");
            console.log("Items:", cleanedItems);
            setPage("scraper");
        } else {
            chrome.tabs.create({
                url: "https://www.instagram.com/reels/",
            });
        }
    };

    return (
        <>
            {alert && (
                <Alert
                    message={alert}
                    onClose={() => setAlert(null)}
                />
            )}
            <h1 className="text-4xl font-bold text-blue-600 mb-6 tracking-tight shrink-0">
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
                        border border-blue-200
                        focus:border-blue-500
                        focus:ring-2 focus:ring-blue-200
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
                bg-white border border-blue-200 text-blue-600
                text-base font-semibold
                hover:bg-blue-50
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
                bg-blue-500 text-white
                text-lg font-semibold
                hover:bg-blue-600
                active:scale-95
                transition-all
                shadow-md hover:shadow-blue-200
                shrink-0
            "
            >
            {onReels ? "Begin" : "Open Instagram"}
            </button>
            
        </>
    );
}

export default HomePage;