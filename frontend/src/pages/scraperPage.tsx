import { useState, useEffect } from "react";
import { Check, Loader2, Square } from "lucide-react";

type TopicStat = {
  label: string;
  percent: number;
};

type ReelItem = {
  shortcode: string;
  video_duration: number | null;
  caption: string | null;
  thumbnail_url: string | null;
  ai_summary: string | null;
  status: "loading" | "done" | "error";
  match?: boolean | null;
};

type StepStatus = "done" | "active" | "pending";

type RunStep = {
  label: string;
  status: StepStatus;
};

export default function ScraperPage() {
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [currentCaption, setCurrentCaption] = useState<string | null>(null);
  const [currentBatchReel, setCurrentBatchReel] = useState<ReelItem | null>(null);
  const [processedReels, setProcessedReels] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const [topics] = useState<TopicStat[]>([
    { label: "dogs", percent: 20 },
    { label: "cats", percent: 40 },
    { label: "other", percent: 40 },
  ]);

  const [steps, setSteps] = useState<RunStep[]>([
    { label: "Analyzing reel", status: "pending" },
    { label: "Liking reel", status: "pending" },
    { label: "Opening comments", status: "pending" },
    { label: "Updating algorithm", status: "pending" },
  ]);

  const updateStepStatus = (label: string, status: StepStatus) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.label === label ? { ...step, status } : step
      )
    );
  };

  const resetSteps = () => {
    setSteps([
      { label: "Analyzing reel", status: "pending" },
      { label: "Liking reel", status: "pending" },
      { label: "Opening comments", status: "pending" },
      { label: "Updating algorithm", status: "pending" },
    ]);
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const sendMessageAsync = (message: any) => {
    return new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  };

  const getActiveTab = async (): Promise<chrome.tabs.Tab | null> => {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        resolve(tabs[0] ?? null);
      });
    });
  };

  const getActiveTabUrl = async (): Promise<string | null> => {
    const tab = await getActiveTab();
    return tab?.url ?? null;
  };

  const refreshCurrentUrl = async () => {
    const url = await getActiveTabUrl();
    setCurrentUrl(url);
    return url;
  };

  const scrollNTimes = async (n: number = 1) => {
    for (let i = 0; i < n; i++) {
      try {
        await sendMessageAsync({ action: "scrollReel" });
        console.log(`Scroll ${i + 1} complete`);
        await sleep(1200);
        await refreshCurrentUrl();
      } catch (error) {
        console.error(`Scroll ${i + 1} failed`, error);
        break;
      }
    }
  };

  const normalizeCaption = (caption: string | null | undefined) => {
    return (caption ?? "").trim().toLowerCase();
  };

  const captionsMatch = (
    a: string | null | undefined,
    b: string | null | undefined
  ) => {
    const aa = normalizeCaption(a);
    const bb = normalizeCaption(b);

    if (!aa || !bb) return false;

    if (aa === bb) return true;

    return aa.includes(bb) || bb.includes(aa);
  };

  const getCurrentVideoCaption = async (): Promise<string | null> => {
    try {
      const response = await sendMessageAsync({ action: "getCurrentCaption" });
      return response?.caption ?? null;
    } catch (error) {
      console.error("Failed to get current caption:", error);
      return null;
    }
  };

  const getLatestReelsFromStorage = async (): Promise<ReelItem[]> => {
    return new Promise((resolve) => {
      chrome.storage.local.get(["latestReelData"], (result) => {
        const reelsObject = result.latestReelData || {};
        resolve(Object.values(reelsObject) as ReelItem[]);
      });
    });
  };

  const findMatchingBatchReelByCaption = (
    batch: ReelItem[],
    caption: string | null
  ): ReelItem | null => {
    if (!caption) return null;

    return batch.find((reel) => captionsMatch(reel.caption, caption)) ?? null;
  };

  const getProcessedKey = (reel: ReelItem) => {
    return reel.shortcode || normalizeCaption(reel.caption);
  };

  const handleStop = () => {
    chrome.runtime.sendMessage({ action: "stopRun" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error:", chrome.runtime.lastError.message);
        return;
      }
      console.log("Stopped:", response);
    });
  };

  const handleMatchTrue = async (reel: ReelItem) => {
    console.log("Match is true for reel:", reel);

    updateStepStatus("Analyzing reel", "done");
    await sleep(500);

    updateStepStatus("Liking reel", "active");
    await sendMessageAsync({ action: "likePost" });
    updateStepStatus("Liking reel", "done");
    await sleep(500);

    updateStepStatus("Opening comments", "active");
    await sendMessageAsync({ action: "openComments" });
    updateStepStatus("Opening comments", "done");
    await sleep(1000);

    updateStepStatus("Updating algorithm", "active");
    updateStepStatus("Updating algorithm", "done");
    await sleep(500);
  };

  const handleMatchFalse = async (reel: ReelItem) => {
    console.log("Match is false for reel:", reel);

    updateStepStatus("Analyzing reel", "done");
    await sleep(300);
  };

  // Initial URL load
  useEffect(() => {
    refreshCurrentUrl();
  }, []);

  // Load reels from storage on mount
  useEffect(() => {
    chrome.storage.local.get(["latestReelData"], (result) => {
      const reelsObject = result.latestReelData || {};
      setReels(Object.values(reelsObject) as ReelItem[]);
    });
  }, []);

  // Listen for reel updates in storage
  useEffect(() => {
    const listener = (changes: any, areaName: string) => {
      if (areaName === "local" && changes.latestReelData) {
        const updatedObject = changes.latestReelData.newValue || {};
        setReels(Object.values(updatedObject) as ReelItem[]);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const processLoop = async () => {
      if (isProcessing) return;

      setIsProcessing(true);

      try {
        while (!cancelled) {
          await refreshCurrentUrl();

          const latestReels = await getLatestReelsFromStorage();
          setReels(latestReels);
          console.log("Latest batch:", latestReels);

          // Step 1: if there is no batch, scroll
          if (!latestReels.length) {
            console.log("No batch found, scrolling...");
            setCurrentBatchReel(null);
            setCurrentCaption(null);
            resetSteps();
            await scrollNTimes(1);
            await sleep(1500);
            continue;
          }

          // Step 2: get current caption
          const caption = await getCurrentVideoCaption();
          setCurrentCaption(caption);
          console.log("Current caption:", caption);

          // Step 3: if no caption, scroll
          if (!caption) {
            console.log("No caption found for current reel, scrolling...");
            setCurrentBatchReel(null);
            resetSteps();
            await scrollNTimes(1);
            await sleep(1500);
            continue;
          }

          // Step 4: check if caption exists in batch
          const matchedReel = findMatchingBatchReelByCaption(reels, caption);
          setCurrentBatchReel(matchedReel);
          console.log("Matched reel from batch:", matchedReel);

          // Step 5: if not in batch, scroll
          if (!matchedReel) {
            console.log("Caption not found in batch, scrolling...");
            resetSteps();
            await scrollNTimes(1);
            await sleep(1500);
            continue;
          }

          const processedKey = getProcessedKey(matchedReel);

          // Skip if already processed
          if (processedReels.has(processedKey)) {
            console.log("Already processed this reel, scrolling...");
            await scrollNTimes(1);
            await sleep(1500);
            continue;
          }

          resetSteps();
          updateStepStatus("Analyzing reel", "active");
          await sleep(300);

          // Step 6: if in batch, check match value
          if (matchedReel.match === true) {
            await handleMatchTrue(matchedReel);
          } else if (matchedReel.match === false) {
            await handleMatchFalse(matchedReel);
          } else {
            console.log("Matched reel found, but match is still null/undefined. Waiting...");
            await sleep(1200);
            continue;
          }

          // Mark as processed
          setProcessedReels((prev) => {
            const next = new Set(prev);
            next.add(processedKey);
            return next;
          });

          // Step 7: after handling true/false, scroll
          await scrollNTimes(1);
          await sleep(1500);
        }
      } catch (error) {
        console.error("Processing loop failed:", error);
      } finally {
        if (!cancelled) {
          setIsProcessing(false);
        }
      }
    };

    processLoop();

    return () => {
      cancelled = true;
    };
  }, [processedReels, isProcessing]);

  return (
    <>
      <div>
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

        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-pink-100 p-4 mt-4">
          <div className="rounded-xl bg-gradient-to-r from-pink-50 via-orange-50 to-purple-50 border border-pink-100 p-3 mb-3">
            <p className="text-sm font-medium text-gray-800">
              Currently processing:
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {currentBatchReel?.caption ||
                currentCaption ||
                currentUrl ||
                (isProcessing ? "Processing..." : "Loading...")}
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

        <div className="absolute bottom-0 left-0 w-full p-3 bg-white/95 backdrop-blur-sm border-t border-pink-100">
          <div className="flex gap-3">
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
          </div>
        </div>
      )}
    </>
  );
}