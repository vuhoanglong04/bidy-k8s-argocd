import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "@/types";
import { Mail, Phone, Shield, User as UserIcon } from "lucide-react";
import { getValidText, getImageURL } from "@/utils";
import { getDefaultAvatar } from "@/lib/image-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useRef } from "react";
import { useUpdateAvatar, useProfile } from "@/services/user";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import {
  ACCEPTED_IMAGE_MIME_TYPES,
  IMAGE_ACCEPT_ATTR,
  MAX_IMAGE_SIZE_MB,
  type AcceptedImageMimeType,
} from "@/constants";

interface ProfileSidebarProps {
  profile: User;
  isLoading: boolean;
}

function ProfileSidebar({ profile, isLoading }: ProfileSidebarProps) {
  const { theme } = useTheme();
  const [isHovering, setIsHovering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateAvatarMutation = useUpdateAvatar();
  const { refetchProfile } = useProfile();


  const handleAvatarClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type — phải khớp đúng danh sách backend nhận
    if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type as AcceptedImageMimeType)) {
      alert(
        `Chỉ chấp nhận file: ${ACCEPTED_IMAGE_MIME_TYPES.map((type) => type.split('/')[1]).join(', ')}`
      );
      return;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      alert(`Kích thước file không được vượt quá ${MAX_IMAGE_SIZE_MB}MB`);
      return;
    }

    setIsUploading(true);

    try {
      await updateAvatarMutation.mutateAsync(file);
      await refetchProfile(); // Refresh profile data
    } catch (error) {
      console.error('Avatar upload error:', error);
      alert('Có lỗi xảy ra khi cập nhật ảnh đại diện');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return (
      <Card className="h-fit">
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="w-48 h-48 rounded-full" />
            <div className="text-center space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="w-full space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-4">
          {/* Avatar with Upload Functionality */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT_ATTR}
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
            
            <div 
              className="relative group cursor-pointer"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              onClick={handleAvatarClick}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getImageURL(profile?.avatarUrl) ?? getDefaultAvatar(theme)}
                alt={getValidText(profile?.fullname)}
                width={200}
                height={200}
                className="rounded-full object-cover w-[200px] h-[200px] border-4 border-primary transition-all duration-200 group-hover:brightness-75"
              />
              {/* Upload overlay */}
              <div className={cn(
                "absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity duration-200",
                isHovering || isUploading ? "opacity-100" : "opacity-0"
              )}>
                {isUploading ? (
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <span className="text-sm">Đang tải...</span>
                  </div>
                ) : (
                  <div className="text-white text-center">
                    <UserIcon className="w-8 h-8 mx-auto mb-2" />
                    <span className="text-sm">Thay đổi ảnh</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {getValidText(profile?.fullname) || "Chưa cập nhật"}
            </h2>
            <div className="flex items-center justify-center gap-2">
              <Badge variant={profile?.role === "admin" ? "default" : "secondary"}>
                <Shield className="w-3 h-3 mr-1" />
                {profile?.role === "admin" ? "Quản trị viên" : "Người dùng"}
              </Badge>
            </div>
          </div>

          {/* Contact Information */}
          <div className="w-full space-y-3 text-sm">
            {profile?.email && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground break-all">{profile.email}</span>
              </div>
            )}
            
            {profile?.phone && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-foreground">{profile.phone}</span>
              </div>
            )}

          </div>

          {/* Account Status */}
          <div className="w-full pt-4 border-t border-border">
            <div className="text-center text-xs text-muted-foreground">
              Tài khoản{" "}
              <Badge variant={profile?.status ? "default" : "destructive"} className="text-xs">
                {profile?.status ? "Đang hoạt động" : "Bị khóa"}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProfileSidebar;