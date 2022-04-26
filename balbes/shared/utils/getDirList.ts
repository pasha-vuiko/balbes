import { readdir } from 'fs/promises';

export const getDirList = async (source: string): Promise<string[]> => {
  const filesList = await readdir(source, { withFileTypes: true });

  return filesList.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
};
