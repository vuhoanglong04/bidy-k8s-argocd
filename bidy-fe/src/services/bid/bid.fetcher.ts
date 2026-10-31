import { STATUS_AUCTIONS } from "@/constants/app.enum";
import { API_ROUTES } from "@/constants";
import axiosClient from "@/lib/axios-client";

export const fetchCategories = async () => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_CATEGORIES);
  return res.data;
};

export const fetchMyAuctions = async () => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_MY);
  return res.data;
};

export const fetchAuctionCart = async () => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_CART);
  return res.data;
};

export const fetchAuctionEnd = async () => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_LIST, {
    params: { status: STATUS_AUCTIONS.ENDED },
  });
  return res.data;
};

export const fetchAuctionByStatus = async (status: string) => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_LIST, { params: { status } });
  return res.data;
};

export const fetchUserAuctionByStatus = async (id: string, status: string) => {
  const res = await axiosClient.get(
    API_ROUTES.AUCTION_USER_BY_STATUS(id, status)
  );
  return res.data;
};

export const fetchUserBuyAuction = async (id: string) => {
  console.log('Fetching bid history for user:', id);
  const url = API_ROUTES.AUCTION_USER_BUY(id);
  console.log('Bid history URL:', url);
  const res = await axiosClient.get(url);
  console.log('Bid history response:', res.data);
  return res.data;
};

export const fetchUserSellAuction = async (id: string) => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_USER_SELL(id));
  return res.data;
};

export const fetchAuctionById = async (id: string) => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_BY_ID(id));
  return res.data;
};

export const fetchAuctionSearch = async (keyword: string) => {
  const res = await axiosClient.get(API_ROUTES.AUCTION_SEARCH(keyword));
  return res.data;
};

export const buyNow = async (id: string) => {
  const res = await axiosClient.post(API_ROUTES.AUCTION_BUY_NOW(id));
  return res.data;
};

interface PlaceBidPayload {
  price?: number;
  amount: number;
  isAuto?: boolean;
  limitBid?: number;
  incrementAmount?: number;
}

export const placeBid = async (id: string, payload: PlaceBidPayload) => {
  const res = await axiosClient.post(API_ROUTES.AUCTION_BID(id), payload);
  return res.data;
};

// NOTE: auto-bid đã chuyển sang `autobid.fetcher.ts` (enableAutoBid/
// disableAutoBid/fetchAutoBidStatus) để gom về đúng contract `{ limitBid }`.

export const deleteMyAuction = async (id: string) => {
  const res = await axiosClient.delete(API_ROUTES.AUCTION_DELETE(id));
  return res.data;
};

export const cancelAuction = async (id: string) => {
  const res = await axiosClient.post(API_ROUTES.AUCTION_CANCEL(id));
  return res.data;
};

export const updateProduct = async (id: string, formData: FormData) => {
  const res = await axiosClient.put(API_ROUTES.AUCTION_BY_ID(id), formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};
