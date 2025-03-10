import { ApiConfiguration } from "@/shared/api";

export type IGlobalState = {
    apiConfiguration: ApiConfiguration
    allowedCommands: string[]
    taskDirectory: string
}
