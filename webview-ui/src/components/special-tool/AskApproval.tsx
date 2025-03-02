import { ComponentRenderer } from "./type";
import { headerStyle, toolIcon } from "./common";
import yaml from "js-yaml";
import MarkdownBlock from "../common/MarkdownBlock";
import { vscode } from "@webview-ui/utils/vscode";

// 审批组件
export const AskApprovalComponent: ComponentRenderer = (tool) => {
    console.log('[waht]', tool);
    const handleApproval = () => {
        vscode.postMessage({
            type: "userApproval",
            payload: {tool: {type: 'approval', content: tool.content}}
        });
    }
    return (
        <>
            <div style={headerStyle}>
                {toolIcon("question")}
                <span style={{fontWeight: "bold"}}>Roo ask approval:</span>
            </div>
            <MarkdownBlock markdown={"```yaml\n" + yaml.dump(tool.content) + "```"}></MarkdownBlock>
            <button onClick={handleApproval}>ok</button>
            <button>no</button>
        </>
    );
};