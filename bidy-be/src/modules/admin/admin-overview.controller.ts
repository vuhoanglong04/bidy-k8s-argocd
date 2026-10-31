import { Request, Response, NextFunction } from 'express';
import { AdminOverviewService } from './admin-overview.service';
import { StatisticsYearDto } from './dtos/admin-auction.dto';
import { apiResponse } from '../../common/util/api-response';

export class AdminOverviewController {
  private readonly adminOverviewService: AdminOverviewService;

  constructor() {
    this.adminOverviewService = new AdminOverviewService();
  }

  public getUserOverview = async (_req: Request, res: Response, _next: NextFunction) => {
    try {
      const data = await this.adminOverviewService.getUserOverview();
      return res.status(200).json(apiResponse('success', 'User overview retrieved successfully.', data));
    } catch (err: any) {
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public getAuctionOverview = async (_req: Request, res: Response, _next: NextFunction) => {
    try {
      const data = await this.adminOverviewService.getAuctionOverview();
      return res.status(200).json(apiResponse('success', 'Auction overview retrieved successfully.', data));
    } catch (err: any) {
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public getCategoryOverview = async (_req: Request, res: Response, _next: NextFunction) => {
    try {
      const data = await this.adminOverviewService.getCategoryOverview();
      return res.status(200).json(apiResponse('success', 'Category overview retrieved successfully.', data));
    } catch (err: any) {
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public getAuctionsByMonth = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { year } = req.query as unknown as StatisticsYearDto;
      const data = await this.adminOverviewService.getAuctionsByMonth(year ?? new Date().getFullYear());
      return res.status(200).json(apiResponse('success', 'Auction statistics retrieved successfully.', data));
    } catch (err: any) {
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };

  public getUsersByMonth = async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { year } = req.query as unknown as StatisticsYearDto;
      const data = await this.adminOverviewService.getUsersByMonth(year ?? new Date().getFullYear());
      return res.status(200).json(apiResponse('success', 'User statistics retrieved successfully.', data));
    } catch (err: any) {
      return res.status(500).json(apiResponse('error', err.message || 'Server error'));
    }
  };
}
