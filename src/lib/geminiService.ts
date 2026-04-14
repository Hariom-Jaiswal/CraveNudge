// src/lib/geminiService.ts
export const analyzeFood = async (inputType: "text" | "image", input: string, userId: string) => {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: inputType, input, userId }),
  });

  if (!response.ok) {
    let errorMsg = "Failed to analyze food";
    try {
      const errorData = await response.json();
      if (errorData.error) errorMsg = errorData.error;
    } catch(e) {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return data;
};

export const getNearbyPlaces = async (lat: number, lng: number, goal: string, healthScore: number) => {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lng: lng.toString(),
    goal,
    healthScore: healthScore.toString(),
  });

  const response = await fetch(`/api/places?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch nearby places");
  }

  return response.json();
};
