import { ApiConfiguration } from "@/shared/api";

export type ISecret = {
  apiKey?: string;
  glamaApiKey?: string;
  openRouterApiKey?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsSessionToken?: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  openAiNativeApiKey?: string;
  deepSeekApiKey?: string;
  mistralApiKey?: string;
}

export type IGlobalState = {
    apiConfiguration: ApiConfiguration
    allowedCommands: string[]
    taskDirectory: string
}
