import { CloudflareBindings } from "../types";

export async function triggerMakeScenario(
  payload: any,
  env: CloudflareBindings
) {
  try {
    console.log("Starting Make scenario trigger with configuration:", {
      hasMakeScenarioId: !!env.MAKE_SCENARIO_ID,
      hasMakeApiToken: !!env.MAKE_API_TOKEN,
      payloadSize: JSON.stringify(payload).length,
      timestamp: new Date().toISOString(),
    });

    if (!env.MAKE_SCENARIO_ID || !env.MAKE_API_TOKEN) {
      console.error("環境変数が設定されていません", {
        hasMakeScenarioId: !!env.MAKE_SCENARIO_ID,
        hasMakeApiToken: !!env.MAKE_API_TOKEN,
        timestamp: new Date().toISOString(),
      });
      throw new Error(
        "Missing required environment variables: MAKE_SCENARIO_ID or MAKE_API_TOKEN"
      );
    }

    console.log("Preparing Make API request:", {
      scenarioId: env.MAKE_SCENARIO_ID,
      url: `https://us2.make.com/api/v2/scenarios/${env.MAKE_SCENARIO_ID}/run`,
      timestamp: new Date().toISOString(),
    });

    const formattedPayload = {
      data: {
        "My collection": payload,
      },
      responsive: false,
    };

    console.log("Sending request to Make API with payload size:", {
      payloadSize: JSON.stringify(formattedPayload).length,
      timestamp: new Date().toISOString(),
    });

    const response = await fetch(
      `https://us2.make.com/api/v2/scenarios/${env.MAKE_SCENARIO_ID}/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${env.MAKE_API_TOKEN}`,
        },
        body: JSON.stringify(formattedPayload),
      }
    );

    console.log("Received response from Make API:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      timestamp: new Date().toISOString(),
    });

    const responseText = await response.text();
    console.log("Raw response text:", responseText);

    let responseData;

    try {
      responseData = JSON.parse(responseText);
      console.log("Parsed response data:", {
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to parse Make API response as JSON:", {
        responseText,
        error: e instanceof Error ? e.message : "Unknown parsing error",
        timestamp: new Date().toISOString(),
      });
      responseData = responseText;
    }

    if (!response.ok) {
      const error = `Make API error: ${response.status} ${response.statusText}`;
      console.error(error, {
        responseData,
        requestPayload: payload,
        timestamp: new Date().toISOString(),
      });
      return {
        ok: false,
        error,
      };
    }

    console.log("Successfully completed Make scenario trigger", {
      timestamp: new Date().toISOString(),
    });
    return {
      ok: true,
      data: responseData,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Make API call failed:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      payload,
      timestamp: new Date().toISOString(),
    });
    return {
      ok: false,
      error: errorMessage,
    };
  }
}
