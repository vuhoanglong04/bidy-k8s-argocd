import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const YEAR_RANGE = 4;

/** Năm hiện tại và 3 năm trước đó — đủ cho biểu đồ thống kê. */
const years = Array.from({ length: YEAR_RANGE }, (_, i) =>
  String(new Date().getFullYear() - i)
);

export function YearSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[104px] cursor-pointer rounded-none text-sm">
        <SelectValue placeholder="Chọn năm" />
      </SelectTrigger>
      <SelectContent>
        {years?.map((year) => (
          <SelectItem key={year} value={year} className="cursor-pointer">
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
