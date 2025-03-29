export const MESSAGE_EVENTS = {
	/** 后台消息事件，用于来自从electron的消息 */
	BACKGROUND_MESSAGE: 'background-message',
	/** 应用消息事件，用于处理应用内部的消息 */
	APP_MESSAGE: 'app-message',
} as const;

export const {
	BACKGROUND_MESSAGE,
	APP_MESSAGE
} = MESSAGE_EVENTS;