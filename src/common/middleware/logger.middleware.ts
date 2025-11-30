import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const startTime = Date.now();

    // Store original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: unknown;

    // Override res.send to capture response body
    res.send = function (body: unknown) {
      responseBody = body;
      return originalSend.call(this, body) as Response;
    };

    // Override res.json to capture JSON response body
    res.json = function (body: unknown) {
      responseBody = body;
      return originalJson.call(this, body) as Response;
    };

    res.on('finish', () => {
      // log request details
      console.log(
        `Request: ${method} ${originalUrl} ${req.body ? JSON.stringify(req.body) : ''}`,
      );

      // log response details
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const errorMsg = statusCode >= 400 ? ` ERROR:${res.statusMessage}` : '';

      // Format response body for logging
      let responseBodyStr = '';
      if (responseBody) {
        try {
          responseBodyStr =
            typeof responseBody === 'string'
              ? responseBody
              : JSON.stringify(responseBody);

          // Truncate large responses for readability
          if (responseBodyStr.length > 1000) {
            responseBodyStr =
              responseBodyStr.substring(0, 1000) + '... (truncated)';
          }
        } catch {
          responseBodyStr = '[Unable to stringify response]';
        }
      }

      console.log(`Response: ${statusCode}${errorMsg} - ${duration}ms`);
      if (responseBodyStr) {
        console.log(`Response Body: ${responseBodyStr}`);
      }
    });

    next();
  }
}
