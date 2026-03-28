import { useState, useEffect } from "react";
import { Check, Loader2, Square } from "lucide-react";

type TopicStat = {
  label: string;
  percent: number;
};

type ReelItem = {
  id: number;
  title: string;
  approved: boolean | null;
};

type StepStatus = "done" | "active" | "pending";

type RunStep = {
  label: string;
  status: StepStatus;
};

export default function ScraperPage() {
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);

  const [topics] = useState<TopicStat[]>([
    { label: "dogs", percent: 20 },
    { label: "cats", percent: 40 },
    { label: "other", percent: 40 },
  ]);

  const [reels, setReels] = useState<ReelItem[]>([]);

  const [steps] = useState<RunStep[]>([
    { label: "Analyzing reel", status: "done" },
    { label: "Liking reel", status: "done" },
    { label: "Opening comments", status: "active" },
    { label: "Updating algorithm", status: "pending" },
  ]);

  // const markReel = (id: number, approved: boolean) => {
  //   setUpcomingReels((prev) =>
  //     prev.map((reel) => (reel.id === id ? { ...reel, approved } : reel))
  //   );
  // };

  const handleStop = () => {
    chrome.runtime.sendMessage({ action: "stopRun" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error:", chrome.runtime.lastError.message);
        return;
      }
      console.log("Stopped:", response);
    });
  };

  useEffect(() => {
    chrome.storage.local.get(["latestReelData"], (result) => {
      const reelsObject = result.latestReelData || {};
      setReels(Object.values(reelsObject));
    });
  }, []);

  useEffect(() => {
    const listener = (changes: any, areaName: string) => {
      if (areaName === "local" && changes.latestReelData) {
        setReels(changes.latestReelData.newValue || {});
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <>
      <div>
        {/* Algorithm Progress */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-pink-100 p-4">
          <h2
            className="
              text-sm font-semibold mb-3
              bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]
              bg-clip-text text-transparent
            "
          >
            Algorithm Progress
          </h2>

          <div className="space-y-3">
            {topics.map((topic) => (
              <div key={topic.label}>
                <div className="flex justify-between text-sm mb-1 text-gray-700">
                  <span className="capitalize">{topic.label}</span>
                  <span className="font-medium">{topic.percent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-pink-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] transition-all duration-300"
                    style={{ width: `${topic.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Current Reel */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-pink-100 p-4 mt-4">
          <h2
            className="
              text-sm font-semibold mb-3
              bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]
              bg-clip-text text-transparent
            "
          >
            Current Reel
          </h2>

          <div className="rounded-xl bg-gradient-to-r from-pink-50 via-orange-50 to-purple-50 border border-pink-100 p-3 mb-3">
            <p className="text-sm font-medium text-gray-800">
              Currently processing:
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {reels[1]?.title || "Loading..."}
            </p>
          </div>

          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.label}
                className="flex items-center justify-between rounded-xl px-3 py-2 bg-gray-50 border border-pink-50"
              >
                <span className="text-sm text-gray-700">{step.label}</span>

                {step.status === "done" && (
                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <Check size={16} />
                    Done
                  </span>
                )}

                {step.status === "active" && (
                  <span className="flex items-center gap-1 text-pink-600 text-sm font-medium">
                    <Loader2 size={16} className="animate-spin" />
                    Running
                  </span>
                )}

                {step.status === "pending" && (
                  <span className="text-sm text-gray-400">Pending</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 w-full p-3 bg-white/95 backdrop-blur-sm border-t border-pink-100">
          <div className="flex gap-3">
            {/* <button
              onClick={() => setShowUpcomingModal(true)}
              className="
                flex-1 py-3 rounded-2xl bg-white font-semibold
                border border-pink-200 text-pink-500
                shadow-sm hover:bg-pink-50 transition
              "
            >
              Upcoming
            </button> */}

            <button
              onClick={handleStop}
              className="
                flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl
                bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]
                text-white font-semibold shadow-md hover:opacity-90 transition
              "
            >
              <Square size={16} fill="currentColor" />
              Stop
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming Reels Modal */}
      {showUpcomingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-pink-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="
                  text-base font-semibold
                  bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]
                  bg-clip-text text-transparent
                "
              >
                Upcoming Reels
              </h2>
              <button
                onClick={() => setShowUpcomingModal(false)}
                className="
                  text-sm px-3 py-1 rounded-full
                  bg-pink-50 text-pink-600
                  hover:bg-pink-100 transition
                "
              >
                Close
              </button>
            </div>

            {/* <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {upcomingReels.map((reel) => (
                <div
                  key={reel.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-pink-100 bg-gradient-to-r from-white to-pink-50 px-3 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {reel.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {reel.approved === true
                        ? "Included in algorithm"
                        : reel.approved === false
                        ? "Excluded from algorithm"
                        : "Not reviewed yet"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => markReel(reel.id, false)}
                      className={`p-2 rounded-full border transition ${
                        reel.approved === false
                          ? "bg-red-100 border-red-200 text-red-600"
                          : "bg-white border-pink-100 text-gray-500 hover:bg-pink-50"
                      }`}
                    >
                      <X size={16} />
                    </button>

                    <button
                      onClick={() => markReel(reel.id, true)}
                      className={`p-2 rounded-full border transition ${
                        reel.approved === true
                          ? "bg-pink-100 border-pink-200 text-pink-600"
                          : "bg-white border-pink-100 text-gray-500 hover:bg-pink-50"
                      }`}
                    >
                      <Heart size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div> */}
          </div>
        </div>
      )}
    </>
  );
}