"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { productInventoryKeys } from "@/services/product";
import {
  approveAuctionRequest,
  createAuctionRequest,
  deleteAuctionRequest,
  fetchAdminAuctionRequests,
  fetchAuctionRequestById,
  fetchMyAuctionRequests,
  getAuctionRequestErrorMessage,
  rejectAuctionRequest,
  updateAdminAuctionRequest,
  updateAuctionRequest,
  type AdminAuctionRequestsParams,
  type CreateAuctionRequestBody,
  type MyAuctionRequestsParams,
  type UpdateAuctionRequestBody,
} from "./auction-request.fetcher";

export const auctionRequestKeys = {
  all: ["auction-requests"] as const,
  mine: (params?: MyAuctionRequestsParams) =>
    [...auctionRequestKeys.all, "mine", params] as const,
  admin: (params?: AdminAuctionRequestsParams) =>
    [...auctionRequestKeys.all, "admin", params] as const,
  detail: (id: string) => [...auctionRequestKeys.all, "detail", id] as const,
};

export const useMyAuctionRequests = (params?: MyAuctionRequestsParams) => {
  return useQuery({
    queryKey: auctionRequestKeys.mine(params),
    queryFn: () => fetchMyAuctionRequests(params),
  });
};

export const useAuctionRequest = (id: string) => {
  return useQuery({
    queryKey: auctionRequestKeys.detail(id),
    queryFn: () => fetchAuctionRequestById(id),
    enabled: Boolean(id),
  });
};

export const useCreateAuctionRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateAuctionRequestBody) => createAuctionRequest(body),
    onError: (error) => {
      toast.error(
        getAuctionRequestErrorMessage(error, "Không thể gửi yêu cầu đăng phiên")
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auctionRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: productInventoryKeys.mine() });
    },
  });
};

export const useUpdateAuctionRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateAuctionRequestBody;
    }) => updateAuctionRequest(id, body),
    onError: (error) => {
      toast.error(
        getAuctionRequestErrorMessage(error, "Không thể cập nhật yêu cầu")
      );
    },
    onSuccess: () => {
      toast.success("Cập nhật yêu cầu thành công");
      queryClient.invalidateQueries({ queryKey: auctionRequestKeys.all });
    },
  });
};

export const useDeleteAuctionRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAuctionRequest(id),
    onError: (error) => {
      toast.error(
        getAuctionRequestErrorMessage(error, "Không thể rút lại yêu cầu")
      );
    },
    onSuccess: () => {
      toast.success("Đã rút lại yêu cầu đăng phiên");
      queryClient.invalidateQueries({ queryKey: auctionRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: productInventoryKeys.mine() });
    },
  });
};

/* ==========================================================================
   ADMIN HOOKS
   ========================================================================== */

export const useAdminAuctionRequests = (params?: AdminAuctionRequestsParams) => {
  return useQuery({
    queryKey: auctionRequestKeys.admin(params),
    queryFn: () => fetchAdminAuctionRequests(params),
  });
};

export const useUpdateAdminAuctionRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: UpdateAuctionRequestBody;
    }) => updateAdminAuctionRequest(id, body),
    onError: (error) => {
      toast.error(
        getAuctionRequestErrorMessage(error, "Không thể cập nhật yêu cầu")
      );
    },
    onSuccess: () => {
      toast.success("Cập nhật yêu cầu thành công");
      queryClient.invalidateQueries({ queryKey: auctionRequestKeys.all });
    },
  });
};

export const useApproveAuctionRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => approveAuctionRequest(id),
    onError: (error) => {
      toast.error(
        getAuctionRequestErrorMessage(error, "Không thể duyệt yêu cầu")
      );
      // Backend re-checks product rules, which may fail if product state changed.
      // Invalidate query to refresh admin queue.
      queryClient.invalidateQueries({ queryKey: auctionRequestKeys.all });
    },
    onSuccess: () => {
      toast.success("Đã duyệt yêu cầu đăng phiên thành công");
      queryClient.invalidateQueries({ queryKey: auctionRequestKeys.all });
    },
  });
};

export const useRejectAuctionRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectAuctionRequest(id, reason),
    onError: (error) => {
      toast.error(
        getAuctionRequestErrorMessage(error, "Không thể từ chối yêu cầu")
      );
      queryClient.invalidateQueries({ queryKey: auctionRequestKeys.all });
    },
    onSuccess: () => {
      toast.success("Đã từ chối yêu cầu đăng phiên");
      queryClient.invalidateQueries({ queryKey: auctionRequestKeys.all });
    },
  });
};

