import http, { Server } from 'node:http';
import { cpus } from 'node:os';
import { resolve } from 'node:path';

import { BalbesConfigInterface } from './interfaces/balbesConfigInterface';
import { RouteControllerParams } from './interfaces/route/controller.interface';
import { StaticPool } from 'node-worker-threads-pool';
import { getDirList } from './shared/utils/getDirList';
import { BalbesRouteInterface } from './interfaces/route/route.interface';
import { ServerResponse } from 'http';

class Balbes {
  private server: Server;
  private workerPool: StaticPool<any, any>;
  private apiFolderPath: string;
  private routes: Map<string, Route>;

  constructor(private config: BalbesConfigInterface) {
    this.apiFolderPath = config.apiFolderPath;
    this.routes = new Map<string, Route>();
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

    for (const route of apiRootRoutes) {
      const routeDir = resolve(this.apiFolderPath, route, 'router.js');
      const { routes } = await import(routeDir);

      this.initSubRoutes(routes, route, routeDir);
    }
  }

  private initSubRoutes(
    subRoutes: BalbesRouteInterface[],
    routeRootPath: string,
    routeDir: string
  ) {
    subRoutes.forEach((route, index) => {
      const routeKey = this.getRouteKey(route.method, routeRootPath);

      this.routes.set(routeKey, { index, dirPath: routeDir });
    });
  }

  private getRouteKey(method: string, url: string): string {
    return `${method}.${url}`;
  }

  private initWorkerThreadPool(poolSize?: number): void {
    const numberOfCPUs = cpus().length;
    const computedPoolSize = Math.floor(numberOfCPUs / 1.5) || 1;

    this.workerPool = this.workerPool = new StaticPool({
      size: poolSize ?? computedPoolSize,
      task: `${__dirname}/workers/handle-request.js`
    });
  }

  private handleRequest<T>(route: Route, params: RouteControllerParams): Promise<T> { // TODO add types
    return this.workerPool.exec({ route, params });
  }
}

export const balbes = (config: BalbesConfigInterface) => {
  return new Balbes(config);
};

interface Route {
  index: number;
  dirPath: string;
}
