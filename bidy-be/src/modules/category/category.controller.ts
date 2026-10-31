import { Request, Response } from 'express';
import { CategoryService } from './category.service.js';
import { apiResponse, paginatedResponse } from '../../common/util/api-response.js';
import { CategoryQueryDto } from './dtos/category-query.dto.js';
import { CATEGORY_MESSAGE } from '../../common/messages/category/category.message.js';

export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  getAll = async (req: Request, res: Response) => {
    try {
      const query = req.query as unknown as CategoryQueryDto;
      const { items, totalItems, page, limit } = await this.categoryService.findAll(query);
      return res.status(200).json(
        paginatedResponse(CATEGORY_MESSAGE.GET_ALL_SUCCESS, items, page, limit, totalItems),
      );
    } catch (error: any) {
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  getTree = async (_req: Request, res: Response) => {
    try {
      const tree = await this.categoryService.findTree();
      return res.status(200).json(
        apiResponse('success', CATEGORY_MESSAGE.GET_TREE_SUCCESS, tree),
      );
    } catch (error: any) {
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const category = await this.categoryService.getCategoryDetail(req.params.id as string);
      return res.status(200).json(
        apiResponse('success', CATEGORY_MESSAGE.GET_BY_ID_SUCCESS, category),
      );
    } catch (error: any) {
      if (error.message === CATEGORY_MESSAGE.CATEGORY_NOT_FOUND) {
        return res.status(404).json(apiResponse('fail', CATEGORY_MESSAGE.NOT_FOUND));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  getChildren = async (req: Request, res: Response) => {
    try {
      const children = await this.categoryService.findChildrenById(req.params.id as string);
      return res.status(200).json(
        apiResponse('success', CATEGORY_MESSAGE.GET_CHILDREN_SUCCESS, children),
      );
    } catch (error: any) {
      if (error.message === CATEGORY_MESSAGE.CATEGORY_NOT_FOUND) {
        return res.status(404).json(apiResponse('fail', CATEGORY_MESSAGE.NOT_FOUND));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };
}
