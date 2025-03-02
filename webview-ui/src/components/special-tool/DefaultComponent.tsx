import { headerStyle, toolIcon } from "./common";
import { ComponentRenderer } from "./type";
import yaml from "js-yaml";
import MarkdownBlock from "../common/MarkdownBlock";

// 默认兜底组件 - 当没有找到匹配的组件时使用
export const DefaultComponent: ComponentRenderer = (tool) => {
    console.warn(`[ComponentRouter] 未找到匹配组件: ${tool || '未知子类型'}`);
    return (
        <>
            <div style={headerStyle}>
                {toolIcon("warning")}
                <span style={{fontWeight: "bold"}}>unknown tool type:</span>
            </div>
            <MarkdownBlock markdown={"```yaml\n" + yaml.dump(tool.content) + "```"}></MarkdownBlock>
        </>
    );
};