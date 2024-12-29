import { CloudflareBindings } from "../types";

export async function triggerMakeScenario(
  payload: any,
  env: CloudflareBindings
) {
  try {
    console.log("Calling Make API with scenario ID:", env.MAKE_SCENARIO_ID);
    console.log("Request payload:", JSON.stringify(payload, null, 2));

    if (!env.MAKE_SCENARIO_ID || !env.MAKE_API_TOKEN) {
      throw new Error(
        "Missing required environment variables: MAKE_SCENARIO_ID or MAKE_API_TOKEN"
      );
    }

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

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", responseText);
      responseData = responseText;
    }

    if (!response.ok) {
      console.error("Make API error response:", {
        status: response.status,
        statusText: response.statusText,
        responseData,
        endpoint: `https://us2.make.com/api/v2/scenarios/${env.MAKE_SCENARIO_ID}/run`,
        timestamp: new Date().toISOString(),
      });

      throw new Error(
        `Make API error! Status: ${response.status}, Details: ${
          typeof responseData === "object"
            ? JSON.stringify(responseData)
            : responseData
        }`
      );
    }

    console.log("Make API successful response:", responseData);
    return {
      ok: true,
      data: responseData,
    };
  } catch (error) {
    console.error("Make API call failed:", {
      error: error instanceof Error ? error.message : "Unknown error occurred",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString(),
    };
  }
}
