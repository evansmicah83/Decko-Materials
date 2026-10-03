import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response
} from 'express';

type RouteMethod = 'all' | 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put' | 'use';

function wrapHandler(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      Promise.resolve(handler(req, res, next)).catch(next);
    } catch (error) {
      next(error);
    }
  };
}

export function createAsyncRouter() {
  const router = Router();
  const methods: RouteMethod[] = ['all', 'delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'use'];

  for (const method of methods) {
    const register = router[method].bind(router) as (...args: unknown[]) => typeof router;
    const asyncRegister = (...args: unknown[]) =>
      register(...args.map((arg) => typeof arg === 'function' ? wrapHandler(arg as RequestHandler) : arg));
    Object.defineProperty(router, method, { value: asyncRegister });
  }

  return router;
}
