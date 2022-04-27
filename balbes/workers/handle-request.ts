// Access the workerData by requiring it.
import { parentPort } from 'worker_threads';

// Main thread will pass the data you need
// through this event listener.
parentPort?.on('message', async (data) => {
  const { routes } = require(data.route.dirPath);

  const result = await routes[data.route.index].controller(data.params);

  // return the result to main thread.
  parentPort?.postMessage(result);
});
