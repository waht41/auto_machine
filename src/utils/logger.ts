import winston from 'winston';
import path from 'path';
import {getLogPath, createIfNotExists} from '@core/storage/common';

/**
 * Winston日志级别参考:
 * emerg: 0, alert: 1, crit: 2, error: 3,
 * warning: 4, notice: 5, info: 6, debug: 7
 */

// 判断当前环境
const isProd = process.env.NODE_ENV === 'production';

// 确保日志目录存在
const logDir = getLogPath();
createIfNotExists(logDir);

// 创建自定义格式
const customFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.printf(({ timestamp, level, message, ...meta }) => {
		// 处理元数据
		let metaString = '';
		const splat = meta[Symbol.for('splat')];
		if (Array.isArray(splat) && splat.length > 0) {
			metaString = splat.map(item => {
				return typeof item === 'object' && item !== null 
					? JSON.stringify(item) 
					: item;
			}).join(' ');
			metaString = ` ${metaString}`;
		}
		return `${timestamp} ${level.toUpperCase()}: ${message}${metaString}`;
	})
);

// 控制台输出格式
const consoleFormat = winston.format.combine(
	winston.format.colorize(),
	customFormat
);

// 创建所有传输配置
const transports = [
	// 控制台输出 - 只输出error级别
	new winston.transports.Console({
		format: consoleFormat,
		level: 'error'
	}),
  
	// 错误日志文件 - 只记录error级别
	new winston.transports.File({ 
		filename: path.join(logDir, 'error.log'), 
		level: 'error' 
	}),
  
	// 组合日志文件 - 根据环境记录不同级别
	new winston.transports.File({ 
		filename: path.join(logDir, 'combined.log'),
		level: 'info'
	}),
];

// 非生产环境添加debug日志文件
if (!isProd) {
	transports.push(
		new winston.transports.File({ 
			filename: path.join(logDir, 'debug.log'), 
			level: 'debug' 
		})
	);
}

// 创建logger实例
const logger = winston.createLogger({
	level: isProd ? 'error' : 'debug',
	format: customFormat,
	transports,
});

export default logger;
