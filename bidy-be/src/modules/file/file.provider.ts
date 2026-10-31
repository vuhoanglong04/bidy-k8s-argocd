import { AppDataSource } from '../../database/data-source.js';
import { File } from './entity/file.entity.js';
import { FileService } from './file.service.js';

/**
 * Six modules store images and every one of them needs the same presigning and
 * the same upload registration, so they share one instance rather than each
 * route file wiring its own.
 */
export const fileService = new FileService(AppDataSource.getRepository(File));
