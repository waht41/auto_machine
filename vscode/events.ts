export class Emitter<T> {
    private listeners: ((e: T) => void)[] = [];

    public event: Events<T> = (listener: (e: T) => void) => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                this.listeners = this.listeners.filter(l => l !== listener);
            }
        };
    };

    public fire(e: T): void {
        this.listeners.forEach(l => l(e));
    }

    public dispose() {} // Implement if needed
}

export interface Event<T> {
    (listener: (e: T) => void): Disposable;
}

export interface Events<T> {
    (listener: (e: T) => void): Disposable;
}

export interface Disposable {
    dispose(): void;
}