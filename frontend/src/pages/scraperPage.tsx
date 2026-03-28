const ScraperPage = () => {
    // background.js (for Manifest V3)
    const sendAction = (action: string) => {
        chrome.runtime.sendMessage({ action }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error:", chrome.runtime.lastError.message);
                return;
            }
            console.log("Response:", response);
        });
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center 
                        bg-gradient-to-br from-pink-50 to-white px-4 space-y-4">

        <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Reel Controls
        </h2>

        <button
            onClick={() => sendAction("scrollReel")}
            className="w-full max-w-xs py-2 rounded-xl bg-pink-500 text-white 
                    shadow-md hover:bg-pink-600 hover:scale-[1.02] 
                    transition-all duration-200"
        >
            Next Reel
        </button>

        <button
            onClick={() => sendAction("likePost")}
            className="w-full max-w-xs py-2 rounded-xl bg-white text-gray-800 
                    border border-gray-200 shadow-sm 
                    hover:bg-gray-100 hover:scale-[1.02] 
                    transition-all duration-200"
        >
            ❤️ Like
        </button>

        <button
            onClick={() => sendAction("openComments")}
            className="w-full max-w-xs py-2 rounded-xl bg-white text-gray-800 
                    border border-gray-200 shadow-sm 
                    hover:bg-gray-100 hover:scale-[1.02] 
                    transition-all duration-200"
        >
            💬 Comments
        </button>

        </div>
    );
};

export default ScraperPage;