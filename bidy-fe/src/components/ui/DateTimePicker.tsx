"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string, presetType?: string) => void;
  label: string;
  required?: boolean;
  className?: string;
}

interface TimePreset {
  label: string;
  minutes: number;
  color: string;
  presetId: string;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  label,
  required = false,
  className = "",
}) => {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [isClient, setIsClient] = useState(false);
  // Fix hydration mismatch by ensuring client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Parse existing value when component mounts or value changes
  useEffect(() => {
    if (isClient && value && !value.startsWith('PRESET:')) {
      // Only parse custom datetime values, not preset values
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          setSelectedDate(date.toISOString().slice(0, 10)); // YYYY-MM-DD
          setSelectedTime(date.toTimeString().slice(0, 8)); // HH:MM:SS
        }
      } catch (error) {
        console.warn('Invalid date value:', value, error);
      }
    }
  }, [value, isClient]);

  // Dynamic time presets - calculate at submit time
  const timePresets: TimePreset[] = [
    { label: "Ngay bây giờ (30s)", minutes: 0.5, color: "bg-green-500", presetId: "NOW" },
    { label: "5 phút nữa", minutes: 5, color: "bg-blue-500", presetId: "FIVE_MIN" },
    { label: "10 phút nữa", minutes: 10, color: "bg-purple-500", presetId: "TEN_MIN" },
    { label: "30 phút nữa", minutes: 30, color: "bg-orange-500", presetId: "THIRTY_MIN" },
    { label: "1 giờ nữa", minutes: 60, color: "bg-red-500", presetId: "ONE_HOUR" },
    { label: "Tùy chọn khác", minutes: -1, color: "bg-gray-500", presetId: "CUSTOM" },
  ];

  const handlePresetClick = (preset: TimePreset) => {
    if (preset.presetId === "CUSTOM") {
      setShowCustomTime(true);
      return;
    }

    // For dynamic presets, store the preset ID instead of calculated time
    const presetValue = `PRESET:${preset.presetId}`;
    onChange(presetValue, preset.presetId);
    setShowCustomTime(false);
    
    if (preset.presetId === "NOW") {
      toast.success("🕐 Sẽ bắt đầu sau 30 giây kể từ khi đăng sản phẩm (theo giờ Việt Nam)");
    } else if (preset.minutes < 1) {
      toast.success(`🕐 Sẽ bắt đầu ${preset.minutes * 60} giây kể từ khi đăng sản phẩm (theo giờ Việt Nam)`);
    } else {
      toast.success(`🕐 Sẽ bắt đầu ${preset.minutes} phút kể từ khi đăng sản phẩm (theo giờ Việt Nam)`);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    updateDateTime(newDate, selectedTime);
  };

  const handleTimeChange = (newTime: string) => {
    setSelectedTime(newTime);
    updateDateTime(selectedDate, newTime);
  };

  const updateDateTime = (date: string, time: string) => {
    if (date && time && isClient) {
      const dateTimeString = `${date}T${time}`;
      const selectedDateTime = new Date(dateTimeString);
      
      // Get current Vietnam time for comparison
      const now = new Date();
      const vnNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
      const timeDiffMinutes = (selectedDateTime.getTime() - vnNow.getTime()) / (1000 * 60);
      
      // Warn if selected time is too close to current VN time
      if (timeDiffMinutes < 2) {
        toast.warning("⚠️ Thời gian quá gần hiện tại (giờ Việt Nam). Nên chọn ít nhất 3-5 phút nữa để đảm bảo thành công.");
      }
      
      onChange(dateTimeString);
    }
  };

  const formatDisplayTime = (value: string) => {
    if (!value) return "";
    
    // Prevent hydration mismatch during server rendering
    if (!isClient) return "Đang tải...";
    
    // Handle preset values - show actual calculated time in VN timezone
    if (value.startsWith("PRESET:")) {
      const presetId = value.replace("PRESET:", "");
      const preset = timePresets.find(p => p.presetId === presetId);
      if (preset) {
        // Calculate actual time for presets based on VN timezone
        const now = new Date();
        const vnNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
        let calculatedTime = vnNow;
        
        
        if (preset.presetId === "NOW") {
          calculatedTime = new Date(vnNow.getTime() + 30 * 1000); // 30 seconds buffer
        } else {
          calculatedTime = new Date(vnNow.getTime() + preset.minutes * 60 * 1000);
        }
        
        const timeStr = calculatedTime.toLocaleString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          year: "numeric",
          month: "2-digit", 
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        
        
        const displayMap: { [key: string]: string } = {
          'NOW': 'Bắt đầu ngay',
          'FIVE_MIN': 'Bắt đầu sau 5 phút',
          'TEN_MIN': 'Bắt đầu sau 10 phút',
          'THIRTY_MIN': 'Bắt đầu sau 30 phút',
          'ONE_HOUR': 'Bắt đầu sau 1 giờ',
        };
        
        return `${displayMap[presetId] || preset.label} (${timeStr})`;
      }
    }
    
    // Handle custom datetime values
    try {
      const date = new Date(value);
      return date.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit", 
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <label className="block font-semibold text-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </label>

      {/* Smart Display - Show preset selection or custom datetime */}
      {value && (
        <div>
          {value.startsWith("PRESET:") ? (
            // Preset Selection - Large, friendly display
            <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🕰️</div>
                <div>
                  <div className="text-lg font-bold text-green-800">
                    {formatDisplayTime(value)}
                  </div>
                  <div className="text-sm text-green-600">
                    Thời gian sẽ được tính tự động khi đăng sản phẩm
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChange('', '')}
                  className="ml-auto text-green-600 hover:text-green-800 text-sm px-2 py-1 rounded border border-green-300 hover:bg-green-100 transition-all"
                >
                  Thay đổi
                </button>
              </div>
            </div>
          ) : (
            // Custom DateTime - Traditional display
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Thời gian đã chọn:</div>
              <div className="text-lg font-semibold text-blue-800">
                {formatDisplayTime(value)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Preset Buttons - Only show when no preset is selected */}
      {(!value || !value.startsWith("PRESET:")) && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground-secondary">Chọn nhanh:</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {timePresets.map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className={`px-3 py-2 rounded-lg text-white font-medium text-sm transition-all hover:scale-105 ${preset.color} hover:shadow-md`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom Date/Time Selection - Only show when explicitly requested */}
      {showCustomTime && (
        <div className="p-4 border border-border rounded-lg bg-card space-y-3">
          <div className="text-sm font-medium text-foreground">Tùy chọn thời gian cụ thể:</div>
          
          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">
              Chọn ngày:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              min={isClient ? new Date().toISOString().slice(0, 10) : undefined}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Time Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">
              Chọn giờ:
            </label>
            <input
              type="time"
              step="1"
              value={selectedTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                updateDateTime(selectedDate, selectedTime);
                setShowCustomTime(false);
                toast.success("Đã cập nhật thời gian tùy chọn");
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all"
            >
              Xác nhận
            </button>
            <button
              type="button"
              onClick={() => setShowCustomTime(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-all"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Helper Text - Dynamic based on selection state */}
      <div className="text-xs text-foreground-secondary space-y-1">
        {value && value.startsWith("PRESET:") ? (
          <div className="text-green-600">
            ✨ Bạn đã chọn thời gian tự động. Thời gian chính xác sẽ được tính khi đăng sản phẩm.
          </div>
        ) : (
          <div>
            <div>💡 Chọn thời gian bắt đầu đấu giá của bạn</div>
            <div className="text-amber-600">⚠️ Thời gian tùy chọn nên cách hiện tại ít nhất 3-5 phút</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DateTimePicker;