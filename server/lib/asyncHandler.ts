import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Envuelve handlers async para que los errores lleguen al errorHandler de Express. */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
