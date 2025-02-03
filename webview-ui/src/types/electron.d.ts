interface Window {
    electronApi: {
        on: (channel: string, callback: (data: any) => void) => void;
        send: (channel: string, data: any) => void;
        invoke: (channel: string, data: any) => Promise<any>;
    };
}
