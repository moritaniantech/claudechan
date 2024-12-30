export interface SlackChallengeRequest {
  token: string;
  challenge: string;
  type: "url_verification";
}

export interface SlackChallengeResponse {
  challenge: string;
}
