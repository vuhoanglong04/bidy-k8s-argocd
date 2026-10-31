"use client";

import React, { useCallback, useMemo, useState } from "react";
import { ImageWithFallback } from "@/components/common/ImageWithFallback";
import debounce from "lodash.debounce";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LoadingState, Spinner } from "@/components/common/loading";
import {
  USER_ROLE,
  USER_ROLE_LABELS,
  USER_STATUS,
  USER_STATUS_LABELS,
} from "@/constants/app.enum";
import { useAdminUserDetail, useAdminUserList } from "@/services/admin";
import { useUserBuyAuction, useUserSellAuction } from "@/services/bid";
import { AdminBid, AdminUserListParams } from "@/types";
import { formatCurrency, formatDateTime, getImageURL, getValidText, secureRandom } from "@/utils";
import AdminPanel from "./AdminPanel";
import AdminUserActions from "./AdminUserActions";
import AdminUserAuditLogPanel from "./AdminUserAuditLogPanel";
import StatTile from "./StatTile";
import { AccountLockedPill, UserStatusPill } from "./StatusPill";

interface AdminUserListProps {
  setTab: (tab: string) => void;
  setSelectedAuctionId?: (id: string | null) => void;
  /** Id người dùng đang mở chi tiết; `null` = đang ở màn danh sách. */
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
}

/** Giá trị "tất cả" của filter — Radix Select không nhận value rỗng. */
const ALL = "all";

const PAGE_SIZE = 20;

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-40 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm break-words text-foreground">{value}</dd>
    </div>
  );
}

/** Màn chi tiết — tự fetch bằng id để luôn có `summary` và dữ liệu mới nhất. */
function AdminUserDetailView({
  userId,
  onBack,
  setTab,
  setSelectedAuctionId,
}: {
  userId: string;
  onBack: () => void;
  setTab: (tab: string) => void;
  setSelectedAuctionId?: (id: string | null) => void;
}) {
  const { user, isLoading, isError, error, refetchUser } = useAdminUserDetail(userId);
  const { auctionsBuy } = useUserBuyAuction(userId);
  const { auctionsSell } = useUserSellAuction(userId);

  const renderAuctionRow = (prod: AdminBid) => (
    <li
      key={prod?._id ?? secureRandom()}
      className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-accent"
      onClick={() => {
        // TODO(backend): xác minh id từ /auctions/user/bought|sold có phải auction id không
        setSelectedAuctionId?.(prod?._id ?? null);
        setTab("products");
      }}
    >
      <div className="relative size-11 shrink-0 overflow-hidden bg-muted">
        <ImageWithFallback
          src={getImageURL(prod?.image?.[0])}
          alt={getValidText(prod?.name)}
          fill
          sizes="44px"
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {getValidText(prod?.name)}
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {formatCurrency(Number(prod?.price))}
        </p>
      </div>
      <ArrowUpRight size={16} className="shrink-0 text-muted-foreground" />
    </li>
  );

  const renderAuctionPanel = (title: string, list?: AdminBid[]) => (
    <AdminPanel title={title} flush>
      {list?.length ? (
        <ul className="divide-y divide-border">{list.map(renderAuctionRow)}</ul>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Chưa có dữ liệu.
        </p>
      )}
    </AdminPanel>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="cursor-pointer rounded-none"
        >
          <ArrowLeft size={16} /> Quay lại danh sách
        </Button>
      </div>

      <LoadingState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={!user}
        onRetry={refetchUser}
        emptyMessage="Không tìm thấy người dùng này."
      >
        {user && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-5">
              <AdminPanel title="Hồ sơ người dùng">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <Avatar className="size-20 shrink-0">
                    <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-accent text-2xl font-bold text-foreground">
                      {getValidText(user.fullname).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-bold text-foreground">
                        {getValidText(user.fullname)}
                      </h3>
                      <UserStatusPill status={user.status} />
                      {user.accountLocked && <AccountLockedPill />}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      @{getValidText(user.username)}
                    </p>

                    <dl className="mt-4 flex flex-col">
                      <DetailRow label="Email" value={getValidText(user.email)} />
                      <DetailRow
                        label="Vai trò"
                        value={USER_ROLE_LABELS[user.role as USER_ROLE] ?? user.role}
                      />
                      {user.statusReason && (
                        <DetailRow label="Lý do trạng thái" value={user.statusReason} />
                      )}
                      {user.suspendedUntil && (
                        <DetailRow
                          label="Tạm khoá đến"
                          value={formatDateTime(user.suspendedUntil)}
                        />
                      )}
                      {user.lockedUntil && (
                        <DetailRow
                          label="Khoá đăng nhập đến"
                          value={formatDateTime(user.lockedUntil)}
                        />
                      )}
                      <DetailRow
                        label="Bắt buộc đổi mật khẩu"
                        value={user.passwordResetRequired ? "Có" : "Không"}
                      />
                      <DetailRow label="Ngày tạo" value={formatDateTime(user.createdAt)} />
                      <DetailRow
                        label="Cập nhật lần cuối"
                        value={formatDateTime(user.updatedAt)}
                      />
                      <DetailRow
                        label="ID"
                        value={<span className="font-mono text-xs">{user.id}</span>}
                      />
                    </dl>
                  </div>
                </div>
              </AdminPanel>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                <StatTile label="Sản phẩm" value={user.summary?.products ?? 0} />
                <StatTile label="Phiên đấu giá" value={user.summary?.auctions ?? 0} />
                <StatTile label="Đơn đã mua" value={user.summary?.ordersAsBuyer ?? 0} />
                <StatTile label="Đơn đã bán" value={user.summary?.ordersAsSeller ?? 0} />
                <StatTile label="Đánh giá" value={user.summary?.reviews ?? 0} />
                <StatTile label="Yêu cầu hỗ trợ" value={user.summary?.supportTickets ?? 0} />
              </div>

              {renderAuctionPanel("Sản phẩm đã mua gần đây", auctionsBuy)}
              {renderAuctionPanel("Sản phẩm bán đấu giá gần đây", auctionsSell)}
            </div>

            <div className="flex flex-col gap-5">
              <AdminUserActions user={user} />
              <AdminUserAuditLogPanel userId={user.id} />
            </div>
          </div>
        )}
      </LoadingState>
    </div>
  );
}

export default function AdminUserList({
  setTab,
  setSelectedAuctionId,
  selectedUserId,
  setSelectedUserId,
}: AdminUserListProps) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [role, setRole] = useState<string>(ALL);
  const [locked, setLocked] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const params = useMemo<AdminUserListParams>(
    () => ({
      q: keyword || undefined,
      status: status === ALL ? undefined : (status as `${USER_STATUS}`),
      role: role === ALL ? undefined : (role as `${USER_ROLE}`),
      locked: locked === ALL ? undefined : locked === "true",
      page,
      limit: PAGE_SIZE,
    }),
    [keyword, status, role, locked, page]
  );

  const { users, hasNext, isLoading, isError, error, refetchUsers } =
    useAdminUserList(params);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSearch = useCallback(
    debounce((value: string) => {
      setKeyword(value.trim());
      setPage(1);
    }, 500),
    []
  );

  /** Đổi bất kỳ filter nào cũng phải quay về trang đầu, nếu không sẽ rỗng giả. */
  const changeFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  if (selectedUserId) {
    return (
      <AdminUserDetailView
        userId={selectedUserId}
        onBack={() => setSelectedUserId(null)}
        setTab={setTab}
        setSelectedAuctionId={setSelectedAuctionId}
      />
    );
  }

  return (
    <AdminPanel
      title="Danh sách người dùng"
      description="Tìm theo tên đăng nhập, email hoặc ID chính xác"
      action={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Tìm người dùng…"
              className="rounded-none pl-9"
            />
          </div>

          <Select value={status} onValueChange={changeFilter(setStatus)}>
            <SelectTrigger className="h-9 w-full cursor-pointer rounded-none sm:w-40">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="cursor-pointer">
                Mọi trạng thái
              </SelectItem>
              {Object.values(USER_STATUS).map((value) => (
                <SelectItem key={value} value={value} className="cursor-pointer">
                  {USER_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={role} onValueChange={changeFilter(setRole)}>
            <SelectTrigger className="h-9 w-full cursor-pointer rounded-none sm:w-36">
              <SelectValue placeholder="Vai trò" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="cursor-pointer">
                Mọi vai trò
              </SelectItem>
              {Object.values(USER_ROLE).map((value) => (
                <SelectItem key={value} value={value} className="cursor-pointer">
                  {USER_ROLE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={locked} onValueChange={changeFilter(setLocked)}>
            <SelectTrigger className="h-9 w-full cursor-pointer rounded-none sm:w-40">
              <SelectValue placeholder="Khoá đăng nhập" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="cursor-pointer">
                Mọi tài khoản
              </SelectItem>
              <SelectItem value="true" className="cursor-pointer">
                Đang bị khoá
              </SelectItem>
              <SelectItem value="false" className="cursor-pointer">
                Không bị khoá
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
        isEmpty={users.length === 0}
        onRetry={refetchUsers}
        emptyMessage="Không tìm thấy người dùng nào khớp bộ lọc."
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Người dùng</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="pr-5 text-right">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow
                key={u.id}
                className="cursor-pointer"
                onClick={() => setSelectedUserId(u.id)}
              >
                <TableCell className="pl-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarImage src={u.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-accent text-xs font-semibold text-foreground">
                        {getValidText(u.fullname).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{getValidText(u.fullname)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{getValidText(u.username)}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {getValidText(u.email)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {USER_ROLE_LABELS[u.role as USER_ROLE] ?? u.role}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(u.createdAt)}
                </TableCell>
                <TableCell className="pr-5">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <UserStatusPill status={u.status} />
                    {u.accountLocked && <AccountLockedPill />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Phân trang cursor-based: backend không trả tổng số trang. */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            Trang {page}
            {isLoading && <Spinner size="xs" tone="muted" />}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer rounded-none"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              <ChevronLeft size={16} /> Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer rounded-none"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </LoadingState>
    </AdminPanel>
  );
}
