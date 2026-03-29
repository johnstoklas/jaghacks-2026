/** POST /api/runs — response is { id, keyword_expansion }; use id as the run id for /api/runs/{id}/... */
export const handleCreateRun = async (items) => {
  const body = {
    name: "My Run",
    topics: items.join(","),
    ...(items.length ? { seed_words: items } : {}),
  };
  console.log("Creating run with items:", body);
  try {
    const response = await fetch("http://localhost:8080/api/runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    try {
      const stored = await chrome.storage.local.get(["runFeed"]);
      const runFeed = Array.isArray(stored?.runFeed) ? stored.runFeed : [];
      const nextFeed = [data, ...runFeed].slice(0, 50);

      await chrome.storage.local.set({
        latestRun: data,
        runFeed: nextFeed,
      });
    } catch (storageError) {
      // Keep run creation successful even if storage write fails.
      console.error("Failed to cache run in storage:", storageError);
    }

    return data;
  } catch (error) {
    console.error("Failed to send items:", error);
    throw error;
  }
};