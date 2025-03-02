import { ComponentRenderer } from "./type";
import { headerStyle, toolIcon } from "./common";
import yaml from "js-yaml";
import MarkdownBlock from "../common/MarkdownBlock";

// 审批组件
export const AskApprovalComponent: ComponentRenderer = (tool) => {
    console.log('[waht]', tool);
    return (
        <>
            <div style={headerStyle}>
                {toolIcon("question")}
                <span style={{fontWeight: "bold"}}>Roo ask approval:</span>
            </div>
            <MarkdownBlock markdown={"```yaml\n" + yaml.dump(tool.content) + "```"}></MarkdownBlock>
            <button>ok</button>
            <button>no</button>
        </>
    );
};