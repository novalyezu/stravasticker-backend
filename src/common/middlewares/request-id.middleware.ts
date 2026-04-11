import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { X_REQUEST_ID_HEADER } from '../constants';

type RequestWithId = Request & { requestId?: string };

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const headerValue = req.header(X_REQUEST_ID_HEADER);
    const requestId =
      headerValue && headerValue.trim().length > 0 ? headerValue : uuidv7();

    req.requestId = requestId;
    req.headers[X_REQUEST_ID_HEADER] = requestId;
    res.setHeader(X_REQUEST_ID_HEADER, requestId);

    next();
  }
}
