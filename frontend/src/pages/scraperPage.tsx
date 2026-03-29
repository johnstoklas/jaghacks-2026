import { useEffect, useState } from "react";
import { Check, Heart, X, Loader2, Square } from "lucide-react";

type TopicStat = {
  label: string;
  percent: number;
};

type ScraperPageProps = {
  items: string[];
};

type ReelData = {
  shortcode?: string;
  video_duration?: number | null;
  caption?: string | null;
  thumbnail_url?: string | null;
  ai_summary?: string | null;
  approved?: boolean | null;
  shouldWatch?: boolean | null;
};

type StepStatus = "done" | "active" | "pending";

type RunStep = {
  label: string;
  status: StepStatus;
};

export default function ScraperPage({ items }: ScraperPageProps) {
  const DEFAULT_TIMER_SECONDS = 15;

  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [currentReel, setCurrentReel] = useState<ReelData | null>(null);
  const [pageUrl, setPageUrl] = useState("");
  const [timer, setTimer] = useState(DEFAULT_TIMER_SECONDS);

  const topics: TopicStat[] = items.map((item) => ({ label: item, percent: 100 }));

  const [upcomingReels, setUpcomingReels] = useState<Record<string, ReelData>>({});

  const [steps] = useState<RunStep[]>([
    { label: "Analyzing reel", status: "done" },
  ]);

  const getReelTitle = (reel: ReelData): string => {
    return reel.caption?.trim() || reel.ai_summary?.trim() || "Untitled reel";
  };

  const markReel = (shortcode: string, approved: boolean) => {
    setUpcomingReels((prev) => {
      const reel = prev[shortcode];
      if (!reel) return prev;

      return {
        ...prev,
        [shortcode]: { ...reel, approved },
      };
    });
  };

  const setTimerValue = (seconds: number) => {
    setTimer(Math.max(0, Math.floor(seconds)));
  };

  const getTimerSecondsForReel = (reel: ReelData): number => {
    if (!reel.approved) return 1; // skip instantly

    if (typeof reel.video_duration !== "number" || !Number.isFinite(reel.video_duration)) {
      return DEFAULT_TIMER_SECONDS;
    }

    return Math.max(1, Math.ceil(reel.video_duration + 1));
  };

  const setCurrentReelWithTimer = (reel: ReelData) => {
    setCurrentReel(reel);
    setTimerValue(getTimerSecondsForReel(reel));
  };

  const scrollToNextReel = () => {
    chrome.runtime.sendMessage({ action: "scrollReel" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error:", chrome.runtime.lastError.message);
        return;
      }
      console.log("Scrolled to next reel:", response);
    });
  };

  const getShortcodeFromUrl = (url: string): string | null => {
    if (!url) return null;

    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments.at(-1) || null;
    } catch {
      const segments = url.split("/").filter(Boolean);
      return segments.at(-1) || null;
    }
  };

  useEffect(() => {
    const syncActiveTabUrl = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        setPageUrl(tabs[0]?.url || "");
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
        setPageUrl(changeInfo.url);
        return;
      }
      if (changeInfo.status === "complete") {
        setPageUrl(tab.url || "");
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

  useEffect(() => {
    chrome.storage.local.get(["latestReelData", "reelFeed"], (stored) => {
      const latest = stored?.latestReelData as ReelData | undefined;
      const feed = Array.isArray(stored?.reelFeed)
        ? (stored.reelFeed as ReelData[])
        : [];

      if (latest) {
        console.log("Latest reel data:", latest);
        setCurrentReelWithTimer(latest);
      }

      if (feed.length > 0) {
        setUpcomingReels(
          feed.reduce<Record<string, ReelData>>((acc, reel) => {
            if (!reel.shortcode || acc[reel.shortcode]) return acc;
            acc[reel.shortcode] = {
              ...reel,
              approved: reel.approved ?? reel.shouldWatch ?? null,
            };
            return acc;
          }, {})
        );
      }
    });

    const handleRuntimeMessage = (
      message: { action?: string; data?: ReelData },
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: unknown) => void
    ) => {
      if (message.action !== "reelData" || !message.data) return;
      if (!message.data.shortcode) return;

      const nextReel = message.data;
      // setCurrentReel(nextReel);
      setUpcomingReels((prev) => {
        const shortcode = nextReel.shortcode as string;
        const normalized = {
          ...nextReel,
          approved: nextReel.approved ?? nextReel.shouldWatch ?? null,
        };

        return {
          ...prev,
          [shortcode]: normalized,
        };
      });
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, []);

  useEffect(() => {
    const shortcode = getShortcodeFromUrl(pageUrl);
    if (!shortcode) return;

    const matchedReel = upcomingReels[shortcode];
    if (!matchedReel) return;

    setCurrentReelWithTimer(matchedReel);
  }, [pageUrl, upcomingReels]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : prev));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (timer > 0) return;

    scrollToNextReel();
    setTimerValue(DEFAULT_TIMER_SECONDS);
  }, [timer]);

  const handleStop = () => {
    chrome.runtime.sendMessage({ action: "stopRun" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error:", chrome.runtime.lastError.message);
        return;
      }
      console.log("Stopped:", response);
    });
  };

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
            <div className="flex items-start gap-3 text-left">
              <div className="w-24 shrink-0">
                {currentReel?.thumbnail_url ? (
                  <img
                    src={currentReel.thumbnail_url}
                    alt="Current reel thumbnail"
                    className="w-full aspect-[9/16] object-cover rounded-lg border border-pink-100"
                  />
                ) : (
                  <div className="w-full aspect-[9/16] rounded-lg border border-pink-100 bg-white/60" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">Currently processing:</p>
                <p className="text-xs text-gray-500 mt-1 truncate" title={pageUrl || "Unknown URL"}>
                  {pageUrl || "Unknown URL"}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  {currentReel?.approved ? "Approved" : "Not Approved"}
                </p>
                <p className="text-xs text-gray-500 mt-1">Next scroll in {timer}s</p>
                <p className="text-sm text-gray-600 mt-2 line-clamp-4">
                  {currentReel?.caption || currentReel?.ai_summary || "Waiting for first reel..."}
                </p>
              </div>
            </div>
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
            <button
              onClick={() => setShowUpcomingModal(true)}
              className="
                flex-1 py-3 rounded-2xl bg-white font-semibold
                border border-pink-200 text-pink-500
                shadow-sm hover:bg-pink-50 transition
              "
            >
              Upcoming
            </button>

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

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {Object.entries(upcomingReels).map(([shortcode, reel]) => (
                <div
                  key={shortcode}
                  className="flex items-center justify-between gap-3 rounded-xl border border-pink-100 bg-gradient-to-r from-white to-pink-50 px-3 py-3"
                >
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {getReelTitle(reel)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {reel.approved === true
                        ? "Approved"
                        : reel.approved === false
                        ? "Skipped"
                        : "Not reviewed yet"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => markReel(shortcode, false)}
                      className={`p-2 rounded-full border transition ${
                        reel.approved === false
                          ? "bg-red-100 border-red-200 text-red-600"
                          : "bg-white border-pink-100 text-gray-500 hover:bg-pink-50"
                      }`}
                    >
                      <X size={16} />
                    </button>

                    <button
                      onClick={() => markReel(shortcode, true)}
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}