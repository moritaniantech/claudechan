import { CloudflareBindings } from "../types";

export async function triggerMakeScenario(
  payload: any,
  env: CloudflareBindings
) {
  try {
    console.log(
      "Starting Make scenario trigger with payload:",
      JSON.stringify(payload, null, 2)
    );

    if (!env.MAKE_SCENARIO_ID || !env.MAKE_API_TOKEN) {
      console.error("環境変数が設定されていません", {
        hasMakeScenarioId: !!env.MAKE_SCENARIO_ID,
        hasMakeApiToken: !!env.MAKE_API_TOKEN,
      });
      throw new Error(
        "Missing required environment variables: MAKE_SCENARIO_ID or MAKE_API_TOKEN"
      );
    }

    console.log("Sending request to Make API...", {
      scenarioId: env.MAKE_SCENARIO_ID,
      url: `https://us2.make.com/api/v2/scenarios/${env.MAKE_SCENARIO_ID}/run`,
    });

    const formattedPayload = {
      data: {
        "My collection": payload,
      },
      responsive: false,
    };

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
    });

    const responseText = await response.text();
    console.log("Raw response text:", responseText);

    let responseData;

    try {
      responseData = JSON.parse(responseText);
      console.log("Parsed response data:", responseData);
    } catch (e) {
      console.error("Failed to parse Make API response as JSON:", {
        responseText,
        error: e instanceof Error ? e.message : "Unknown parsing error",
      });
      responseData = responseText;
    }

    if (!response.ok) {
      const error = `Make API error: ${response.status} ${response.statusText}`;
      console.error(error, {
        responseData,
        requestPayload: payload,
      });
      return {
        ok: false,
        error,
      };
    }

    console.log("Successfully triggered Make scenario");
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
    });
    return {
      ok: false,
      error: errorMessage,
    };
  }
}
