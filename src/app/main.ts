import { resolve } from 'node:path';

import 'dotenv/config';
import { balbes } from '../../balbes';
import { appConfig } from './shared/config';

const apiFolderPath = resolve(__dirname, 'api');
const app = balbes({ apiFolderPath });

app.listen(+appConfig.port);
