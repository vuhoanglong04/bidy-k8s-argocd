"use client";

import React, { useState } from "react";
import Image from "next/image";
import { isAxiosError } from "axios";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  ChevronRight,
  Eye,
  Play,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  useAdminWithdrawals,
  useProcessAdminWithdrawal,
  useCompleteAdminWithdrawal,
  useRejectAdminWithdrawal,
  type AdminWithdrawalItem,
} from "@/services/admin-wallet";
import { useUploadFile } from "@/services/file";
import { WithdrawalProofDialog } from "@/components/wallet";
import { formatCurrency, formatDateTime, getValidNumber } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState, Spinner } from "@/components/common/loading";
import AdminPanel from "./AdminPanel";
import { WithdrawalStatusPill } from "./StatusPill";

const ALL = "all";

export default function AdminFinanceWithdrawals() {
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [overdueFilter, setOverdueFilter] = useState<string>(ALL);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyAccountNo = async (key: string, accountNo: string) => {
    try {
      await navigator.clipboard.writeText(accountNo);
      setCopiedKey(key);
      toast.success(`Đã sao chép số tài khoản: ${accountNo}`);
      setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 2000);
    } catch {
      toast.error("Không thể sao chép, vui lòng sao chép thủ công");
    }
  };

  const queryParams = {
    status: statusFilter === ALL ? undefined : statusFilter,
    overdue: overdueFilter === ALL ? undefined : overdueFilter,
    cursor,
    limit: 20,
  };

  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminWithdrawals(queryParams);

  // Mutations
  const processMutation = useProcessAdminWithdrawal();
  const completeMutation = useCompleteAdminWithdrawal();
  const rejectMutation = useRejectAdminWithdrawal();
  const uploadMutation = useUploadFile();

  // Action Dialog states
  const [itemToProcess, setItemToProcess] = useState<AdminWithdrawalItem | null>(
    null
  );
  const [itemToComplete, setItemToComplete] =
    useState<AdminWithdrawalItem | null>(null);
  const [itemToReject, setItemToReject] = useState<AdminWithdrawalItem | null>(
    null
  );
  const [viewingProof, setViewingProof] = useState<{
    proofFileId?: string | null;
    proofUrl?: string | null;
  } | null>(null);

  // Form states for Complete Dialog
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>("");
  const [uploadedProofFileId, setUploadedProofFileId] = useState<string>("");

  // Form states for Reject Dialog
  const [rejectReason, setRejectReason] = useState<string>("");

  const handleCloseCompleteDialog = () => {
    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
    }
    setItemToComplete(null);
    setProofPreviewUrl("");
    setUploadedProofFileId("");
  };

  const handleNextPage = () => {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor || ""]);
      setCursor(data.nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const prevCursor = cursorHistory[cursorHistory.length - 1];
      setCursorHistory((prev) => prev.slice(0, -1));
      setCursor(prevCursor || undefined);
    }
  };

  const resetPagination = () => {
    setCursor(undefined);
    setCursorHistory([]);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    resetPagination();
  };

  const handleOverdueChange = (val: string) => {
    setOverdueFilter(val);
    resetPagination();
  };

  // Process Action
  const handleConfirmProcess = async () => {
    if (!itemToProcess?.id) return;
    try {
      await processMutation.mutateAsync(itemToProcess.id);
      toast.success(
        `Đã chuyển yêu cầu rút tiền #${itemToProcess.id} sang trạng thái đang xử lý`
      );
      setItemToProcess(null);
    } catch (err: unknown) {
      let msg = "Không thể cập nhật trạng thái yêu cầu rút tiền.";
      if (isAxiosError(err)) {
        const beMsg = err.response?.data?.message;
        if (typeof beMsg === "string" && beMsg.trim()) {
          msg = beMsg;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    }
  };

  // File Upload for Proof
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (< 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ảnh chứng từ chuyển khoản không được vượt quá 10MB");
      return;
    }

    if (proofPreviewUrl) {
      URL.revokeObjectURL(proofPreviewUrl);
    }
    const localUrl = URL.createObjectURL(file);
    setProofPreviewUrl(localUrl);

    try {
      const uploadRes = await uploadMutation.mutateAsync({
        file,
        purpose: "withdrawal_proof",
      });
      if (uploadRes?.id) {
        setUploadedProofFileId(uploadRes.id);
        toast.success("Tải lên ảnh chứng từ chuyển khoản thành công");
      } else {
        toast.error("Không nhận được phản hồi từ hệ thống");
      }
    } catch (err: unknown) {
      let msg = "Không thể tải lên ảnh chứng từ chuyển khoản. Vui lòng thử lại.";
      if (isAxiosError(err)) {
        const beMsg = err.response?.data?.message;
        if (typeof beMsg === "string" && beMsg.trim()) {
          msg = beMsg;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    }
  };

  // Complete Action
  const handleConfirmComplete = async () => {
    if (!itemToComplete?.id) return;
    if (!uploadedProofFileId) {
      toast.error("Vui lòng tải lên ảnh chứng từ chuyển khoản");
      return;
    }

    try {
      await completeMutation.mutateAsync({
        id: itemToComplete.id,
        payload: { proof_file_id: uploadedProofFileId },
      });
      toast.success(
        `Đã hoàn tất duyệt chi yêu cầu rút tiền #${itemToComplete.id}`
      );
      handleCloseCompleteDialog();
    } catch (err: unknown) {
      let msg = "Không thể hoàn tất yêu cầu rút tiền. Vui lòng thử lại.";
      if (isAxiosError(err)) {
        const beMsg = err.response?.data?.message;
        if (typeof beMsg === "string" && beMsg.trim()) {
          msg = beMsg;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    }
  };

  // Reject Action
  const handleConfirmReject = async () => {
    if (!itemToReject?.id) return;
    try {
      await rejectMutation.mutateAsync({
        id: itemToReject.id,
        payload: { reject_reason: rejectReason.trim() || undefined },
      });
      toast.success(
        `Đã từ chối và hoàn tiền về ví cho yêu cầu rút tiền #${itemToReject.id}`
      );
      setItemToReject(null);
      setRejectReason("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Không thể từ chối yêu cầu rút tiền. Vui lòng thử lại.";
      toast.error(msg);
    }
  };

  const totalLiabilityNum = getValidNumber(data?.totalUserLiability);
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* Khối thông tin: Tổng tiền trong ví người dùng */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-primary/10 text-primary shrink-0 border border-border">
            <Banknote size={20} />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Tổng tiền trong ví người dùng:
            </span>
            <span className="text-lg font-bold font-mono text-foreground">
              {formatCurrency(totalLiabilityNum)}
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              * Lưu ý: Đảm bảo số dư tài khoản ngân hàng thực tế của sàn luôn
              đủ số tiền này trước khi duyệt chi.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="cursor-pointer rounded-none text-xs shrink-0"
        >
          <RefreshCw
            size={14}
            className={`mr-1.5 ${isFetching ? "animate-spin" : ""}`}
          />
          Làm mới
        </Button>
      </div>

      {/* Danh sách yêu cầu rút tiền */}
      <AdminPanel
        title="Quản lý yêu cầu rút tiền"
        description="Theo dõi, duyệt chi và đối soát các yêu cầu rút tiền về ngân hàng của người dùng"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-9 w-36 rounded-none text-xs">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-xs">
                  Mọi trạng thái
                </SelectItem>
                <SelectItem value="pending" className="text-xs">
                  Chờ xử lý
                </SelectItem>
                <SelectItem value="processing" className="text-xs">
                  Đang xử lý
                </SelectItem>
                <SelectItem value="completed" className="text-xs">
                  Đã hoàn tất
                </SelectItem>
                <SelectItem value="rejected" className="text-xs">
                  Đã từ chối
                </SelectItem>
                <SelectItem value="cancelled" className="text-xs">
                  Người dùng hủy
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={overdueFilter} onValueChange={handleOverdueChange}>
              <SelectTrigger className="h-9 w-36 rounded-none text-xs">
                <SelectValue placeholder="Hạn xử lý" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-xs">
                  Tất cả thời hạn
                </SelectItem>
                <SelectItem value="true" className="text-xs">
                  Quá hạn 10 ngày
                </SelectItem>
                <SelectItem value="false" className="text-xs">
                  Trong hạn xử lý
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        flush
      >
        <LoadingState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={items.length === 0}
          onRetry={refetch}
          emptyMessage="Không tìm thấy yêu cầu rút tiền nào phù hợp bộ lọc."
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Mã yêu cầu</TableHead>
                <TableHead>Người dùng</TableHead>
                <TableHead className="text-right">Số tiền rút</TableHead>
                <TableHead>Tài khoản nhận</TableHead>
                <TableHead>Nguồn tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hạn xử lý</TableHead>
                <TableHead className="pr-5 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const amountNum = getValidNumber(item.amount);
                const isOverdue =
                  item.deadlineAt &&
                  (item.status === "pending" || item.status === "processing") &&
                  new Date(item.deadlineAt).getTime() < Date.now();

                const selfTopup = getValidNumber(
                  item.sourceBreakdown?.selfTopup
                );
                const salesRevenue = getValidNumber(
                  item.sourceBreakdown?.salesRevenue
                );

                return (
                  <TableRow
                    key={item.id}
                    className={
                      isOverdue
                        ? "bg-destructive/5 hover:bg-destructive/10"
                        : "hover:bg-muted/40"
                    }
                  >
                    <TableCell className="pl-5 font-mono text-xs font-semibold">
                      #{item.id}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>Người dùng #{item.userId}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Mã ví #{item.walletId}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-foreground">
                      {formatCurrency(amountNum)}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1 font-semibold text-foreground">
                        <span>
                          {item.bankCode} ·{" "}
                          <span className="font-mono">{item.bankAccountNo}</span>
                        </span>
                        {item.bankAccountNo && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyAccountNo(
                                `${item.id}-${item.bankAccountNo}`,
                                item.bankAccountNo ?? "",
                              )
                            }
                            className="p-1 text-muted-foreground transition-colors hover:text-foreground"
                            title="Sao chép số tài khoản"
                            aria-label="Sao chép số tài khoản"
                          >
                            {copiedKey === `${item.id}-${item.bankAccountNo}` ? (
                              <Check className="size-3.5 text-success" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground uppercase">
                        {item.bankAccountName}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.sourceBreakdown ? (
                        <div className="space-y-0.5">
                          <div>Tiền nạp: {formatCurrency(selfTopup)}</div>
                          <div>Tiền bán hàng: {formatCurrency(salesRevenue)}</div>
                        </div>
                      ) : (
                        "---"
                      )}
                    </TableCell>
                    <TableCell>
                      <WithdrawalStatusPill status={item.status} />
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={
                            isOverdue
                              ? "font-bold text-destructive flex items-center gap-1"
                              : "text-muted-foreground"
                          }
                        >
                          {isOverdue && <AlertTriangle size={12} />}
                          {item.deadlineAt
                            ? formatDateTime(item.deadlineAt)
                            : "---"}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] text-destructive uppercase font-semibold">
                            Quá hạn xử lý!
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status === "pending" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setItemToProcess(item)}
                            className="h-7 cursor-pointer rounded-none text-xs font-semibold"
                          >
                            <Play size={12} className="mr-1" /> Tiếp nhận
                          </Button>
                        )}

                        {item.status === "processing" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setItemToComplete(item);
                                setProofPreviewUrl("");
                                setUploadedProofFileId("");
                              }}
                              className="h-7 cursor-pointer rounded-none text-xs font-semibold bg-success text-success-foreground hover:bg-success/90"
                            >
                              <CheckCircle2 size={12} className="mr-1" /> Hoàn tất
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setItemToReject(item);
                                setRejectReason("");
                              }}
                              className="h-7 cursor-pointer rounded-none text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                            >
                              <XCircle size={12} className="mr-1" /> Từ chối
                            </Button>
                          </>
                        )}

                        {item.status === "completed" && (item.proofUrl || item.proofFileId) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setViewingProof({
                                proofFileId: item.proofFileId,
                                proofUrl: item.proofUrl,
                              })
                            }
                            className="h-7 cursor-pointer rounded-none text-xs text-primary"
                          >
                            <Eye size={12} className="mr-1" /> Xem chứng từ
                          </Button>
                        )}

                        {item.status === "rejected" && item.rejectReason && (
                          <span
                            title={item.rejectReason}
                            className="text-xs text-destructive truncate max-w-28 inline-block"
                          >
                            Lý do: {item.rejectReason}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Phân trang con trỏ (Cursor Pagination) */}
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>
              {items.length > 0
                ? `Hiển thị ${items.length} yêu cầu rút tiền`
                : "Không có dữ liệu"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={cursorHistory.length === 0}
                onClick={handlePrevPage}
                className="h-8 cursor-pointer rounded-none text-xs"
              >
                <ChevronLeft size={14} className="mr-1" /> Trang trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data?.nextCursor}
                onClick={handleNextPage}
                className="h-8 cursor-pointer rounded-none text-xs"
              >
                Trang tiếp <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        </LoadingState>
      </AdminPanel>

      {/* ALERT DIALOG TIẾP NHẬN XỬ LÝ */}
      <AlertDialog
        open={Boolean(itemToProcess)}
        onOpenChange={(open) => !open && setItemToProcess(null)}
      >
        <AlertDialogContent className="rounded-none sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Tiếp nhận xử lý yêu cầu rút tiền #{itemToProcess?.id}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground space-y-2">
              <p>
                Chuyển trạng thái yêu cầu rút số tiền{" "}
                <strong className="text-foreground">
                  {formatCurrency(getValidNumber(itemToProcess?.amount))}
                </strong>{" "}
                sang <strong>Đang xử lý</strong>.
              </p>
              <p>
                Người dùng sẽ không thể tự hủy yêu cầu sau khi hệ thống tiếp nhận.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={processMutation.isPending}
              className="rounded-none text-xs"
            >
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmProcess}
              disabled={processMutation.isPending}
              className="rounded-none text-xs font-semibold"
            >
              {processMutation.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="xs" tone="onColor" /> Đang tiếp nhận...
                </span>
              ) : (
                "Xác nhận tiếp nhận"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG HOÀN TẤT RÚT TIỀN */}
      <Dialog
        open={Boolean(itemToComplete)}
        onOpenChange={(open) => !open && handleCloseCompleteDialog()}
      >
        <DialogContent className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-success flex items-center gap-2">
              <CheckCircle2 size={18} /> Hoàn tất yêu cầu rút tiền #
              {itemToComplete?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Vui lòng tải lên ảnh chụp biên lai giao dịch ngân hàng để đối soát (bắt buộc).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            {/* Tóm tắt thông tin chuyển khoản */}
            <div className="p-3 bg-muted/40 border border-border space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số tiền chuyển:</span>
                <span className="font-bold font-mono text-foreground text-sm">
                  {formatCurrency(getValidNumber(itemToComplete?.amount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ngân hàng thụ hưởng:</span>
                <span className="font-semibold text-foreground">
                  {itemToComplete?.bankCode} - {itemToComplete?.bankAccountNo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tên chủ tài khoản:</span>
                <span className="font-semibold uppercase text-foreground">
                  {itemToComplete?.bankAccountName}
                </span>
              </div>
            </div>

            {/* Input upload file ảnh chứng từ */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground block">
                Ảnh chứng từ chuyển khoản (Bắt buộc)
              </label>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border p-5 text-center bg-card">
                {proofPreviewUrl ? (
                  <div className="space-y-3 w-full">
                    <div className="relative mx-auto h-48 w-full max-w-sm overflow-hidden border border-border">
                      <Image
                        src={proofPreviewUrl}
                        alt="Ảnh chứng từ chuyển khoản"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      {uploadMutation.isPending ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                          <Spinner size="xs" tone="muted" /> Đang tải ảnh lên...
                        </span>
                      ) : uploadedProofFileId ? (
                        <span className="text-xs text-success flex items-center gap-1 font-semibold">
                          <CheckCircle2 size={14} /> Đã tải lên ảnh chứng từ
                        </span>
                      ) : (
                        <span className="text-xs text-destructive flex items-center gap-1 font-semibold">
                          <AlertCircle size={14} /> Tải lên thất bại, vui lòng chọn lại ảnh
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload size={24} className="text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Chọn ảnh chụp biên lai chuyển tiền (JPG, PNG, WEBP)
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploadMutation.isPending}
                  className="mt-3 block text-xs file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary-hover cursor-pointer"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseCompleteDialog}
              disabled={completeMutation.isPending || uploadMutation.isPending}
              className="rounded-none text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleConfirmComplete}
              disabled={
                completeMutation.isPending ||
                uploadMutation.isPending ||
                !uploadedProofFileId
              }
              className="rounded-none text-xs font-semibold bg-success text-success-foreground hover:bg-success/90"
            >
              {completeMutation.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="xs" tone="onColor" /> Đang hoàn tất...
                </span>
              ) : (
                "Xác nhận hoàn tất"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG TỪ CHỐI RÚT TIỀN */}
      <Dialog
        open={Boolean(itemToReject)}
        onOpenChange={(open) => !open && setItemToReject(null)}
      >
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle size={18} /> Từ chối yêu cầu rút tiền #{itemToReject?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Toàn bộ số tiền{" "}
              <strong>
                {formatCurrency(getValidNumber(itemToReject?.amount))}
              </strong>{" "}
              sẽ được hoàn trả lại ví của người dùng ngay lập tức.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <label className="text-xs font-semibold text-foreground block">
              Lý do từ chối (không bắt buộc, sẽ gửi cho người dùng)
            </label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="VD: Sai số tài khoản ngân hàng, tên chủ tài khoản không khớp..."
              rows={3}
              className="rounded-none text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setItemToReject(null)}
              disabled={rejectMutation.isPending}
              className="rounded-none text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReject}
              disabled={rejectMutation.isPending}
              className="rounded-none text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectMutation.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="xs" tone="onColor" /> Đang từ chối...
                </span>
              ) : (
                "Xác nhận từ chối và hoàn tiền"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG XEM CHỨNG TỪ */}
      <WithdrawalProofDialog
        open={Boolean(viewingProof)}
        onOpenChange={(open) => !open && setViewingProof(null)}
        proofFileId={viewingProof?.proofFileId}
        proofUrl={viewingProof?.proofUrl}
      />
    </div>
  );
}
