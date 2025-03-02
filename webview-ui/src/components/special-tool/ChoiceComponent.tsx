import { headerStyle, toolIcon } from "./common";
import ASelect from "../common/ASelect";
import { vscode } from "../../utils/vscode";
import { ComponentRenderer } from "./type";

export const ChoiceComponent: ComponentRenderer = (tool) => {
    console.log('[waht]', tool);
    return (
        <>
            <div style={headerStyle}>
                {toolIcon("question")}
                <span style={{fontWeight: "bold"}}>Roo has a question:</span>
            </div>
            <ASelect
                title={tool.question}
                options={tool.choices}
                onConfirm={(value) => {
                    vscode.postMessage({
                        type: "answer",
                        payload: {result: value, uuid: tool.uuid}
                    });
                }}
                result={tool.result}
            />
        </>
    );
};

// 多选组件
export const MultiChoiceComponent: ComponentRenderer = (tool) => {
    console.log('[waht]', tool);
    return (
        <>
            <div style={headerStyle}>
                {toolIcon("question")}
                <span style={{fontWeight: "bold"}}>Roo has multiple choices:</span>
            </div>
            <ASelect
                title={tool.question}
                options={tool.choices}
                mode="multiple"
                onConfirm={(value) => {
                    vscode.postMessage({
                        type: "answer",
                        payload: {result: value, uuid: tool.uuid}
                    });
                }}
                result={tool.result}
            />
        </>
    );
};