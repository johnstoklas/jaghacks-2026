export const handleCreateRun = async (items) => {
  const body = {
    name: "My Run",
    topics: items.join(","),
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
    const { id: runId } = data;
    chrome.storage.local.set({ runId }, () => {
      console.log("Saved runId:", runId);
    });
    return data;
  } catch (error) {
    console.error("Failed to send items:", error);
    throw error;
  }
};