import { Request, Response } from 'express';
import { ProductService } from './product.service.js';
import { apiResponse, paginatedResponse } from '../../common/util/api-response.js';
import { ProductQueryDto } from './dtos/product-query.dto.js';
import { CreateProductDto } from './dtos/create-product.dto.js';
import { UpdateProductDto } from './dtos/update-product.dto.js';
import { ReorderImagesDto } from './dtos/product-image.dto.js';
import { PRODUCT_MESSAGE } from '../../common/messages/product/product.message.js';
import { AuthRequest } from '../../middlewares/authen.middleware.js';

export class ProductController {
  constructor(private readonly productService: ProductService) {}

  getPublicProducts = async (req: Request, res: Response) => {
    try {
      const query = req.query as unknown as ProductQueryDto;
      const { items, totalItems, page, limit } = await this.productService.findPublicProducts(query);
      return res.status(200).json(
        paginatedResponse(PRODUCT_MESSAGE.GET_ALL_SUCCESS, items, page, limit, totalItems),
      );
    } catch (error: any) {
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  getProductById = async (req: Request, res: Response) => {
    try {
      const product = await this.productService.getProductDetail(req.params.id as string);
      return res.status(200).json(
        apiResponse('success', PRODUCT_MESSAGE.GET_BY_ID_SUCCESS, product),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  createProduct = async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.idUser!;
      const dto = req.body as CreateProductDto;
      const product = await this.productService.createProduct(currentUserId, dto);
      return res.status(201).json(
        apiResponse('success', PRODUCT_MESSAGE.CREATE_SUCCESS, product),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  updateProduct = async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.idUser!;
      const currentUserRole = req.role!;
      const dto = req.body as UpdateProductDto;
      const product = await this.productService.updateProduct(req.params.id as string, currentUserId, currentUserRole, dto);
      return res.status(200).json(
        apiResponse('success', PRODUCT_MESSAGE.UPDATE_SUCCESS, product),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  publishProduct = async (req: AuthRequest, res: Response) => {
    try {
      const product = await this.productService.publishProduct(
        req.params.id as string,
        req.idUser!,
        req.role!,
      );
      return res.status(200).json(
        apiResponse('success', PRODUCT_MESSAGE.UPDATE_STATUS_SUCCESS, product),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  deleteProduct = async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.idUser!;
      const currentUserRole = req.role!;
      await this.productService.softDeleteProduct(req.params.id as string, currentUserId, currentUserRole);
      return res.status(204).send();
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  getMyProducts = async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.idUser!;
      const query = req.query as unknown as ProductQueryDto;
      const { items, totalItems, page, limit } = await this.productService.findMyProducts(currentUserId, query);
      return res.status(200).json(
        paginatedResponse(PRODUCT_MESSAGE.GET_MY_PRODUCTS_SUCCESS, items, page, limit, totalItems),
      );
    } catch (error: any) {
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  uploadImages = async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.idUser!;
      const currentUserRole = req.role!;
      const files = req.files as Express.Multer.File[];
      const images = await this.productService.uploadImages(req.params.id as string, currentUserId, currentUserRole, files);
      return res.status(201).json(
        apiResponse('success', PRODUCT_MESSAGE.IMAGE_UPLOAD_SUCCESS, images),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  deleteImage = async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.idUser!;
      const currentUserRole = req.role!;
      await this.productService.deleteImage(req.params.productId as string, req.params.imageId as string, currentUserId, currentUserRole);
      return res.status(204).send();
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  setPrimaryImage = async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.idUser!;
      const currentUserRole = req.role!;
      await this.productService.setPrimaryImage(req.params.productId as string, req.params.imageId as string, currentUserId, currentUserRole);
      return res.status(200).json(
        apiResponse('success', PRODUCT_MESSAGE.IMAGE_SET_PRIMARY_SUCCESS),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };

  reorderImages = async (req: AuthRequest, res: Response) => {
    try {
      const currentUserId = req.idUser!;
      const currentUserRole = req.role!;
      const dto = req.body as ReorderImagesDto;
      await this.productService.reorderImages(req.params.productId as string, currentUserId, currentUserRole, dto);
      return res.status(200).json(
        apiResponse('success', PRODUCT_MESSAGE.IMAGE_REORDER_SUCCESS),
      );
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json(apiResponse('fail', error.message));
      }
      return res.status(500).json(apiResponse('error', error.message));
    }
  };
}
