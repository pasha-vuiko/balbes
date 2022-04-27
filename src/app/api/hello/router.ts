import { BalbesRouteInterface } from '../../../../balbes/interfaces/route/route.interface';

export const routes: BalbesRouteInterface[] = [
  {
    method: 'GET',
    path: '/',
    controller: async () => 'hello from controller' as any,
  },
  {
    method: 'GET',
    path: '/world',
    controller: async () => 'hello world' as any,
  },
];
