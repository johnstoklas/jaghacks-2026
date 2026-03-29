import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Film, Loader2 } from "lucide-react";
import { API_BASE } from "../constants/api";

type RunOut = {
  id: number;
  name: string;
  topics: string;
  created_at: string;
};

type SavedReelOut = {
  id: number;
  run_id: number;
  reel_ref: string | null;
  created_at: string;
  video_url: string;
};

export default function PlaylistsPage() {
  const [runs, setRuns] = useState<RunOut[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);

  const [selectedRun, setSelectedRun] = useState<RunOut | null>(null);
  const [reels, setReels] = useState<SavedReelOut[]>([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [reelsError, setReelsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRunsLoading(true);
    setRunsError(null);
    fetch(`${API_BASE}/api/runs`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<RunOut[]>;
      })
      .then((data) => {
        if (!cancelled) setRuns(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setRunsError(e.message || "Failed to load runs");
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadReels = useCallback((run: RunOut) => {
    setSelectedRun(run);
    setReels([]);
    setReelsError(null);
    setReelsLoading(true);
    fetch(`${API_BASE}/api/runs/${run.id}/saved-reels`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SavedReelOut[]>;
      })
      .then(setReels)
      .catch((e: Error) => setReelsError(e.message || "Failed to load reels"))
      .finally(() => setReelsLoading(false));
  }, []);

  if (selectedRun) {
    return (
      <div className="flex w-full flex-col items-stretch text-left min-h-0 flex-1">
        <button
          type="button"
          onClick={() => {
            setSelectedRun(null);
            setReels([]);
            setReelsError(null);
          }}
          className="flex items-center gap-1 text-sm text-pink-600 hover:text-pink-800 mb-3 shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          All playlists
        </button>

        <h2 className="text-lg font-semibold text-gray-900 truncate mb-1">
          {selectedRun.name}
        </h2>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{selectedRun.topics}</p>

        {reelsLoading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-6 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading reels…
          </div>
        )}
        {reelsError && (
          <p className="text-sm text-red-600 py-2">{reelsError}</p>
        )}
        {!reelsLoading && !reelsError && reels.length === 0 && (
          <p className="text-sm text-gray-500 py-4">No stored reels for this run yet.</p>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {reels.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-pink-100 bg-white/90 overflow-hidden shadow-sm"
            >
              <video
                className="w-full max-h-[220px] bg-black object-contain"
                src={`${API_BASE}${r.video_url}`}
                controls
                playsInline
              />
              {r.reel_ref && (
                <p className="text-xs text-gray-600 px-3 py-2 truncate" title={r.reel_ref}>
                  {r.reel_ref}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch text-left min-h-0 flex-1">
      <h2 className="text-2xl font-bold mb-1 tracking-tight bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] bg-clip-text text-transparent">
        Playlists
      </h2>
      <p className="text-sm text-gray-500 mb-4">Runs and stored reels from the server.</p>

      {runsLoading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading runs…
        </div>
      )}
      {runsError && (
        <p className="text-sm text-red-600 py-2">
          {runsError}
          <span className="block text-gray-500 mt-1">
            Is the API running at {API_BASE}?
          </span>
        </p>
      )}

      {!runsLoading && !runsError && runs.length === 0 && (
        <p className="text-sm text-gray-500 py-4">No runs yet. Start one from Topics.</p>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {runs.map((run) => (
          <button
            key={run.id}
            type="button"
            onClick={() => loadReels(run)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl border border-pink-200 bg-white/80 text-left hover:bg-pink-50/80 active:scale-[0.99] transition-all"
          >
            <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
              <Film className="w-5 h-5 text-pink-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate">{run.name}</p>
              <p className="text-xs text-gray-500 truncate">{run.topics}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
