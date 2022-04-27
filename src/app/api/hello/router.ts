import { BalbesRouteInterface } from '../../../../balbes/interfaces/route/route.interface';

export const routes: BalbesRouteInterface[] = [
  {
    method: 'GET',
    path: '/',
    controller: async () => 'hello from controller',
  },
  {
    method: 'GET',
    path: '/world',
    controller: async () => 'hello world',
  },
  {
    method: 'GET',
    path: '/query',
    controller: async ({ query }) => query,
  },
];
