import { WebClient } from "@slack/web-api";

export const createSlackClient = (token: string) => {
  return new WebClient(token);
};
