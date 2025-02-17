import { BaseCommandExecutor } from "./base";
import { CommandRunner } from "@executors/runner";
import { AskCommandExecutor } from "@core/internal-implementation/ask";

export const registerInternalImplementation = (codeRunner : CommandRunner) => {
   codeRunner.registerExecutor('base', new BaseCommandExecutor());
   codeRunner.registerExecutor('ask', new AskCommandExecutor())
}