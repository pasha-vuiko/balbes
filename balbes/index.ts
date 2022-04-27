import http, { Server, IncomingMessage, ServerResponse } from 'node:http';
import { cpus } from 'node:os';
import { resolve } from 'node:path';

import { BalbesConfigInterface } from './interfaces/balbesConfigInterface';
import { RouteControllerParams } from './interfaces/route/controller.interface';
import { StaticPool } from 'node-worker-threads-pool';
import { getDirList } from './shared/utils/getDirList';
import { BalbesRouteInterface } from './interfaces/route/route.interface';

class Balbes {
  private server: Server;
  private workerPool: StaticPool<any>;
  private apiFolderPath: string;
  private routes: Map<string, BalbesRoute>;

  constructor(private config: BalbesConfigInterface) {
    this.apiFolderPath = config.apiFolderPath;
    this.routes = new Map<string, BalbesRoute>();
    this.initWorkerThreadPool(config.workerPoolSize);
  }

  public async listen(port: number): Promise<void> {
    await this.initServerRoutes();
    this.initServer();
    this.server.listen(port);
  }

  private initServer(): void {
    this.server = http.createServer(async (req, res) => {
      const url = this.getReqUrl(req);
      const routeKey = this.getRouteKey(req.method as string, url as string);
      const route = this.routes.get(routeKey);

      if (!route) {
        this.handle404(routeKey, res);

        return;
      }

      try {
        const controllerParams = await this.getControllerParams(req);
        const response = await this.handleRequest(route, controllerParams);

        res.end(response);
      } catch (e: Error | any) {
        const { message } = e;

        this.handleReqError(message, 500, res);
      }
    });
  }

  private getReqUrl(req: IncomingMessage): string | undefined {
    const rawUrl = req.url;

    if (!rawUrl) {
      return undefined;
    }

    const urlWithoutQuery = rawUrl.split('?')[0];

    if (urlWithoutQuery[0] === '/') {
      return urlWithoutQuery.replace('/', '');
    }

    return urlWithoutQuery;
  }

  private async getControllerParams(
    req: IncomingMessage
  ): Promise<RouteControllerParams> {
    return {
      query: this.getQueryParams(req.url),
      params: {},
      body: await this.getBody(req),
      extraContext: new Map<string, any>(),
      headers: req.headers,
    };
  }

  private getQueryParams(url: string | undefined): Record<string, string> {
    if (!url) {
      return {};
    }

    const splitedUrl = url.split('?');

    if (splitedUrl.length === 1) {
      return {};
    }

    const stringifiedQueryParams = splitedUrl[1];
    const paramsKeyValues = stringifiedQueryParams.split('&');
    const params: Record<string, string> = {};

    for (const paramKeyVal of paramsKeyValues) {
      const [key, value] = paramKeyVal.split('=');

      params[key] = value;
    }

    return params;
  }

  private async getBody(req: IncomingMessage): Promise<Record<string, any> | null> {
    try {
      const { method } = req;

      if (!method) {
        return await this.readRequestStream(req);
      }

      const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH'];

      if (METHODS_WITH_BODY.includes(method)) {
        return await this.readRequestStream(req);
      }

      return null;
    } catch {
      return null;
    }
  }

  private async readRequestStream(
    req: IncomingMessage
  ): Promise<Record<string, any> | null> {
    const buffers = [];

    for await (const chunk of req) {
      buffers.push(chunk);
    }

    const stringifiedBody = Buffer.concat(buffers).toString();

    if (!stringifiedBody.length) {
      return null;
    }

    return JSON.parse(stringifiedBody);
  }

  private handle404(routeKey: string, res: ServerResponse) {
    const message = `no such route: ${routeKey}`;

    this.handleReqError(message, 404, res);
  }

  private handleReqError(message: string, status: number, res: ServerResponse) {
    console.log(message);

    res
      .writeHead(status, { 'Content-type': 'application/json' })
      .end(JSON.stringify({ message }));
  }

  private async initServerRoutes(): Promise<void> {
    const apiRootRoutes = await getDirList(this.apiFolderPath);

    for (const rootRoute of apiRootRoutes) {
      const rootRouteDir = resolve(this.apiFolderPath, rootRoute, 'router.js');
      const { routes: subRoutes } = await import(rootRouteDir);

      this.initSubRoutes(subRoutes, rootRoute, rootRouteDir);
    }
  }

  private initSubRoutes(
    subRoutes: BalbesRouteInterface[],
    rootRoute: string,
    rootRouteDir: string
  ) {
    subRoutes.forEach((subRoute, index) => {
      const routeKey = this.getRouteKey(subRoute.method, rootRoute.concat(subRoute.path));

      this.routes.set(routeKey, { index, dirPath: rootRouteDir });
    });
  }

  private getRouteKey(method: string, url: string): string {
    const routeKey = `${method}.${url}`;

    if (routeKey.at(-1) === '/') {
      return routeKey.slice(0, -1);
    }

    return routeKey;
  }

  private initWorkerThreadPool(poolSize?: number): void {
    const numberOfCPUs = cpus().length;
    const computedPoolSize = Math.floor(numberOfCPUs / 1.5) || 1;

    this.workerPool = this.workerPool = new StaticPool({
      size: poolSize ?? computedPoolSize,
      task: `${__dirname}/workers/handle-request.js`,
    });
  }

  private async handleRequest(
    route: BalbesRoute,
    params: RouteControllerParams
  ): Promise<string> {
    const result = await this.workerPool.exec({ route, params });

    if (typeof result === 'string') {
      return result;
    }

    try {
      return JSON.stringify(result);
    } catch {
      return result.toString();
    }
  }
}

export const balbes = (config: BalbesConfigInterface) => {
  return new Balbes(config);
};

interface BalbesRoute {
  index: number;
  dirPath: string;
}
