import { CloudflareBindings } from "../types";

export async function triggerMakeScenario(
  payload: any,
  env: CloudflareBindings
) {
  try {
    const response = await fetch(
      `https://eu1.make.com/api/v2/scenarios/${env.MAKE_SCENARIO_ID}/run`,
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
      throw new Error(`Make API error! status: ${response.status}`);
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
