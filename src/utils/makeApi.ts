import { CloudflareBindings } from "../types";

export async function triggerMakeScenario(
  payload: any,
  env: CloudflareBindings
) {
  try {
    console.log("Calling Make API with scenario ID:", env.MAKE_SCENARIO_ID);

    const response = await fetch(
      `https://us2.make.com/api/v2/scenarios/${env.MAKE_SCENARIO_ID}/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${env.MAKE_API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Make API error response:", {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
      });
      throw new Error(
        `Make API error! status: ${response.status}, details: ${errorText}`
      );
    }

    const responseData = await response.json();
    console.log("Make API successful response:", responseData);
    return { ok: true };
  } catch (error) {
    console.error("Make API call failed:", {
      error: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString(),
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
