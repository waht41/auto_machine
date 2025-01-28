import {ApiHandler, buildApiHandler} from "../../api";
import {ApiConfiguration} from "../../shared/api";


describe('simple request', () => {
    let handler: ApiHandler;
    beforeEach(() => {
        const config: ApiConfiguration = {
            apiProvider: 'gemini',
            geminiApiKey: 'AIzaSyABlH1AgkOI4k4YytWcHQLMSHwOMFlozoQ'
        }
        handler = buildApiHandler(config);
    })
    it('should return', async () => {
        const model = handler.getModel()
        // console.log(model.id)
        // console.log(model.info.maxTokens)
        const stream = handler.createMessage('', [{'role': 'user', 'content': 'Hello, how are you?'}])

        for await (const _ of stream) {
        }
    })
})

// const config: ApiConfiguration = {apiProvider: 'gemini', geminiApiKey: 'AIzaSyABlH1AgkOI4k4YytWcHQLMSHwOMFlozoQ'}
// // const config : ApiConfiguration = {apiProvider: 'deepseek', deepSeekApiKey:'sk-6eea01cbe45e45948123560fcce2035f'}
// const handler = buildApiHandler(config)
// const model = handler.getModel()
// console.log(model.id)
// console.log(model.info.maxTokens)
// const x = handler.createMessage('', [{'role': 'user', 'content': 'Hello, how are you?'}])
// for await (const chunk of x) {
//     console.log(chunk)
// }