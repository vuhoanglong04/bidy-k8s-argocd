import { Request, Response } from 'express';
import { CategoryService } from './category.service.js';
import { apiResponse } from '../../common/util/api-response.js';
import { CreateCategoryDto } from './dtos/create-category.dto.js';
import { UpdateCategoryDto } from './dtos/update-category.dto.js';
import { UpdateCategoryStatusDto } from './dtos/update-category-status.dto.js';
import { CATEGORY_MESSAGE } from '../../common/messages/category/category.message.js';

export class AdminCategoryController {
  constructor(private readonly categoryService: CategoryService) { }

  create = async (req: Request, res: Response) => {
    try {
      const dto = req.body as CreateCategoryDto;
      const category = await this.categoryService.createCategory(dto);
      return res.status(201).json(
        apiResponse('success', CATEGORY_MESSAGE.CREATE_SUCCESS, category),
      );
    } catch (error: any) {
      if (
        error.message === CATEGORY_MESSAGE.CATEGORY_ALREADY_EXISTS ||
        error.message === CATEGORY_MESSAGE.MAX_CATEGORY_DEPTH_EXCEEDED ||
        error.message === CATEGORY_MESSAGE.CATEGORY_NOT_FOUND
      ) {
        return res.status(400).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const dto = req.body as UpdateCategoryDto;
      const category = await this.categoryService.updateCategory(id as string, dto);
      return res.status(200).json(
        apiResponse('success', CATEGORY_MESSAGE.UPDATE_SUCCESS, category),
      );
    } catch (error: any) {
      if (error.message === CATEGORY_MESSAGE.CATEGORY_CYCLE_DETECTED) {
        return res.status(409).json(apiResponse('fail', error.message));
      }
      if (
        error.message === CATEGORY_MESSAGE.CATEGORY_ALREADY_EXISTS ||
        error.message === CATEGORY_MESSAGE.MAX_CATEGORY_DEPTH_EXCEEDED ||
        error.message === CATEGORY_MESSAGE.CATEGORY_NOT_FOUND
      ) {
        return res.status(400).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  updateStatus = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const dto = req.body as UpdateCategoryStatusDto;
      const category = await this.categoryService.updateCategoryStatus(id as string, dto);
      return res.status(200).json(
        apiResponse('success', CATEGORY_MESSAGE.UPDATE_STATUS_SUCCESS, category),
      );
    } catch (error: any) {
      if (error.message === CATEGORY_MESSAGE.CATEGORY_NOT_FOUND) {
        return res.status(404).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      await this.categoryService.deleteCategory(id as string);
      return res.status(200).json(
        apiResponse('success', CATEGORY_MESSAGE.DELETE_SUCCESS),
      );
    } catch (error: any) {
      if (
        error.message === CATEGORY_MESSAGE.CATEGORY_HAS_CHILDREN ||
        error.message === CATEGORY_MESSAGE.CATEGORY_HAS_PRODUCTS
      ) {
        return res.status(409).json(apiResponse('fail', error.message));
      }
      if (error.message === CATEGORY_MESSAGE.CATEGORY_NOT_FOUND) {
        return res.status(404).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };
}
