import winston from 'winston';

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format,
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development' 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(
              (info) => {
                const ts: string = String(info.timestamp);
                const lvl: string = String(info.level);
                if (typeof info.message === 'object') {
                  return ts + ' ' + lvl + ': ' + JSON.stringify(info.message, null, 2);
                }
                const msg: string = String(info.message);
                return ts + ' ' + lvl + ': ' + msg;
              }
            )
          )
        : format,
    }),
  ],
});
