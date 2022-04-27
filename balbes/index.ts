import http, { Server } from 'node:http';
import { cpus } from 'node:os';
import { resolve } from 'node:path';

import { BalbesConfigInterface } from './interfaces/balbesConfigInterface';
import { RouteControllerParams } from './interfaces/route/controller.interface';
import { StaticPool } from 'node-worker-threads-pool';
import { getDirList } from './shared/utils/getDirList';
import { BalbesRouteInterface } from './interfaces/route/route.interface';
import { IncomingMessage, ServerResponse } from 'http';

class Balbes {
  private server: Server;
  private workerPool: StaticPool<any, any>;
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
      const url = req.url?.split('/')[1];
      // const url = this.getReqUrl(req);
      const routeKey = this.getRouteKey(req.method as string, url as string);
      const route = this.routes.get(routeKey);

      if (!route) {
        this.handle404(routeKey, res);

        return;
      }

      const controllerParams = await this.getControllerParams(req);
      const response = await this.handleRequest(route, controllerParams);

      res.end(response);
    });
  }

  private getReqUrl(req: IncomingMessage): string | undefined {
    const rawUrl = req.url;

    if (!rawUrl) {
      return undefined;
    }

    if (rawUrl[0] === '/') {
      return rawUrl.replace('/', '');
    }

    return rawUrl;
  }

  private async getControllerParams(req: any): Promise<RouteControllerParams> {
    return {} as RouteControllerParams;
  }

  private handle404(routeKey: string, res: ServerResponse) {
    const message = `no such route: ${routeKey}`;
    console.log(message);

    res
      .writeHead(404, { 'Content-type': 'application/json' })
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
      task: `${__dirname}/workers/handle-request.js`
    });
  }

  private handleRequest<T>(route: BalbesRoute, params: RouteControllerParams): Promise<T> { // TODO add types
    return this.workerPool.exec({ route, params });
  }
}

export const balbes = (config: BalbesConfigInterface) => {
  return new Balbes(config);
};

interface BalbesRoute {
  index: number;
  dirPath: string;
}
