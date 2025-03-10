import { VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { ApiConfiguration } from "@/shared/api";

interface GeminiOptionsProps {
  apiConfiguration: any;
  handleInputChange: (field: keyof ApiConfiguration) => (e: any) => void;
}

const GeminiOptions = ({ apiConfiguration, handleInputChange }: GeminiOptionsProps) => {
  return (
    <div>
      <VSCodeTextField
        value={apiConfiguration?.geminiApiKey || ""}
        style={{ width: "100%" }}
        type="password"
        onInput={handleInputChange("geminiApiKey")}
        placeholder="Enter API Key...">
        <span style={{ fontWeight: 500 }}>Gemini API Key</span>
      </VSCodeTextField>
      
      <div
        style={{
          fontSize: "12px",
          marginTop: 3,
          color: "var(--vscode-descriptionForeground)",
        }}>
        This key is stored locally and only used to make API requests from this extension.
        {!apiConfiguration?.geminiApiKey && (
          <VSCodeLink
            href="https://ai.google.dev/"
            style={{ display: "inline", fontSize: "inherit" }}>
            You can get a Gemini API key by signing up here.
          </VSCodeLink>
        )}
      </div>
    </div>
  );
};

export default GeminiOptions;
