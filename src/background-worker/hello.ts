// 简单的后台服务进程
process.on('message', (message: any) => {
    console.log('Worker received:', message);

    // 回复消息给主进程
    process.send?.({
        type: 'HELLO_RESPONSE',
        data: 'Hello from worker process!'
    });
});

// 保持进程运行
process.on('disconnect', () => {
    process.exit(0);
});

console.log('Hello worker process started！！！!');
