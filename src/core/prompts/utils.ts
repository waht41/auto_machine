import { Anthropic } from "@anthropic-ai/sdk";

export type UserContent = Array<
    Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>

export const formatImagesIntoBlocks = (images?: string[]): Anthropic.ImageBlockParam[] => {
    return images
        ? images.map((dataUrl) => {
            // data:image/png;base64,base64string
            const [rest, base64] = dataUrl.split(",")
            const mimeType = rest.split(":")[1].split(";")[0]
            return {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: base64 },
            } as Anthropic.ImageBlockParam
        })
        : []
}

export function toUserContent(text?: string, images?: string[]): UserContent {
    const userContent: UserContent = []
    if (text) {
        userContent.push({ type: "text", text })
    }
    if (images) {
        const imageBlocks = formatImagesIntoBlocks(images)
        userContent.push(...imageBlocks)
    }
    return userContent
}