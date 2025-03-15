import winston from 'winston';

// {
// 	emerg: 0,
// 	alert: 1,
// 	crit: 2,
// 	error: 3,
// 	warning: 4,
// 	notice: 5,
// 	info: 6,
// 	debug: 7
// }
const logger = winston.createLogger({
	level: 'debug',
	format: winston.format.combine(
		winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 自定义时间戳格式
		winston.format.printf(({ timestamp, level, message, ...meta }) => {
			let metaString = '';
			const splat = meta[Symbol.for('splat')];
			if (Array.isArray(splat) && splat.length > 0) {
				metaString = splat.map(item => {
					if (typeof item === 'object' && item !== null) {
						return JSON.stringify(item);
					} else {
						return item;
					}
				}).join(' ');
				metaString = ` ${metaString}`;
			}
			return `${timestamp} ${level.toUpperCase()}: ${message}${metaString}`;
		})
	),
	transports: [
		new winston.transports.File({ filename: 'error.log', level: 'error' }),
		new winston.transports.File({ filename: 'combined.log' }),
		new winston.transports.File({ filename: 'debug.log', level: 'debug' }),
	],
});

if (process.env.NODE_ENV !== 'production') {
	logger.add(new winston.transports.Console({
		format: winston.format.combine(
			winston.format.colorize() // 颜色高亮（可选）
		),
	}));
}

export default logger;
