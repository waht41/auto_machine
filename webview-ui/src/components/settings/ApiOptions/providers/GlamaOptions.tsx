import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import VSCodeButtonLink from "@webview-ui/components/common/VSCodeButtonLink";
import { getGlamaAuthUrl } from "../utils";
import GlamaModelPicker from "../GlamaModelPicker";
import { ApiConfiguration } from "@/shared/api";

interface GlamaOptionsProps {
  apiConfiguration: any;
  uriScheme?: string;
  handleInputChange: (field: keyof ApiConfiguration) => (e: any) => void;
}

const GlamaOptions = ({ apiConfiguration, uriScheme, handleInputChange }: GlamaOptionsProps) => {
  return (
    <div>
      <VSCodeTextField
        value={apiConfiguration?.glamaApiKey || ""}
        style={{ width: "100%" }}
        type="password"
        onInput={handleInputChange("glamaApiKey")}
        placeholder="Enter API Key...">
        <span style={{ fontWeight: 500 }}>Glama API Key</span>
      </VSCodeTextField>
      
      {!apiConfiguration?.glamaApiKey && (
        <VSCodeButtonLink
          href={getGlamaAuthUrl(uriScheme)}
          style={{ margin: "5px 0 0 0" }}
          appearance="secondary">
          Get Glama API Key
        </VSCodeButtonLink>
      )}
      
      <div
        style={{
          fontSize: "12px",
          marginTop: "5px",
          color: "var(--vscode-descriptionForeground)",
        }}>
        This key is stored locally and only used to make API requests from this extension.
      </div>
      
      <GlamaModelPicker />
    </div>
  );
};

export default GlamaOptions;
