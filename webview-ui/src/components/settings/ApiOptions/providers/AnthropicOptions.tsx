import { VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { Checkbox } from "@webview-ui/components/ui";
import { useState, useEffect } from "react";
import { anthropicModels, ApiConfiguration } from "@/shared/api";

interface AnthropicOptionsProps {
  apiConfiguration: any;
  handleInputChange: (field:  keyof ApiConfiguration) => (e: any) => void;
}

const AnthropicOptions = ({ apiConfiguration, handleInputChange }: AnthropicOptionsProps) => {
  const [anthropicBaseUrlSelected, setAnthropicBaseUrlSelected] = useState(!!apiConfiguration?.anthropicBaseUrl);

  useEffect(() => {
    setAnthropicBaseUrlSelected(!!apiConfiguration?.anthropicBaseUrl);
  }, [apiConfiguration?.anthropicBaseUrl]);

  return (
    <div>
      <VSCodeTextField
        value={apiConfiguration?.apiKey || ""}
        style={{ width: "100%" }}
        type="password"
        onInput={handleInputChange("apiKey")}
        placeholder="Enter API Key...">
        <span style={{ fontWeight: 500 }}>Anthropic API Key</span>
      </VSCodeTextField>

      <Checkbox
        checked={anthropicBaseUrlSelected}
        onChange={(checked: boolean) => {
          setAnthropicBaseUrlSelected(checked);
          if (!checked) {
            handleInputChange("anthropicBaseUrl")({
              target: {
                value: "",
              },
            });
          }
        }}>
        Use custom base URL
      </Checkbox>

      {anthropicBaseUrlSelected && (
        <VSCodeTextField
          value={apiConfiguration?.anthropicBaseUrl || ""}
          style={{ width: "100%", marginTop: 3 }}
          type="url"
          onInput={handleInputChange("anthropicBaseUrl")}
          placeholder="Default: https://api.anthropic.com"
        />
      )}

      <div
        style={{
          fontSize: "12px",
          marginTop: 3,
          color: "var(--vscode-descriptionForeground)",
        }}>
        This key is stored locally and only used to make API requests from this extension.
        {!apiConfiguration?.apiKey && (
          <VSCodeLink
            href="https://console.anthropic.com/settings/keys"
            style={{ display: "inline", fontSize: "inherit" }}>
            You can get an Anthropic API key by signing up here.
          </VSCodeLink>
        )}
      </div>
    </div>
  );
};

export default AnthropicOptions;
