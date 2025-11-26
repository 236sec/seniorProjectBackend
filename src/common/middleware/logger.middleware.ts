import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const startTime = Date.now();

    res.on('finish', () => {
      // log request details
      console.log(
        `Request: ${method} ${originalUrl} ${JSON.stringify(req.body)}`,
      );
      // log response details
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const errorMsg = statusCode >= 400 ? ` ERROR:${res.statusMessage}` : '';
      console.log(`Response: ${statusCode}${errorMsg} - ${duration}ms`);
    });
    next();
  }
}
