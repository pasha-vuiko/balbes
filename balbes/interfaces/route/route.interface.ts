import { RouteController } from './controller.interface';

export interface BalbesRouteInterface {
  path: string;
  method: 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  controller: RouteController;
}
