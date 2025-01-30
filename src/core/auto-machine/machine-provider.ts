export class MachineProvider {
    constructor() {
        console.log('MachineProvider')
    }

    context = {globalStorageUri: {fsPath: 'E:\\project\\javascript\\auto_machine'}}

    getState() {
        return {
            mcpEnabled: false,
            mode: 'code',
            customModes: [],
            alwaysApproveResubmit: false,
            requestDelaySeconds: 5,
            browserViewportSize: {
                width: 800,
                height: 600
            },
            customModePrompts: {},
            preferredLanguage: 'zh',
        }
    }

    postMessageToWebview({}) {
        console.log('postMessageToWebview')
    }

    async postStateToWebview() {
        console.log('postStateToWebview')
    }
}