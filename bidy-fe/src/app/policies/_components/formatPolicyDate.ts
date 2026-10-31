import { formatVNTime } from "@/utils/vnTimezone";

export const formatPolicyDate = (dateString: string): string => {
  return formatVNTime(dateString, {
    hour: undefined,
    minute: undefined,
    second: undefined,
  });
};
