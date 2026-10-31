/**
 * Test kiểm tra không hardcode đường dẫn API trong các lời gọi axiosClient.
 *
 * Bối cảnh: Trước đây có các lời gọi như `axiosClient.get('/bid-history/user')`
 * bị hardcode thay vì dùng `API_ROUTES.*`. Vì `api-routes.contract.test.ts` chỉ
 * kiểm tra các hằng số trong `API_ROUTES` nên các route hardcode này lọt lưới và
 * gây lỗi 404 trong runtime khi backend đổi prefix/cấu trúc endpoint.
 *
 * Mọi lời gọi `axiosClient.<method>(...)` phải dùng hằng số từ `API_ROUTES`
 * (khai báo trong `src/constants/routes.constants.ts`).
 *
 * Ngoại lệ tạm thời (chưa kịp refactor sang API_ROUTES) được đưa vào ALLOWLIST bên dưới
 * kèm lý do giải thích.
 */
import fs from "fs";
import path from "path";

/**
 * Danh sách ngoại lệ tạm thời cho các file chưa hoàn tất refactor sang API_ROUTES.
 * Mỗi entry gồm:
 * - file: đường dẫn tương đối tính từ root repo (ví dụ "src/services/time/time.fetcher.ts")
 * - url (optional): chuỗi hoặc RegExp khớp với URL vi phạm
 * - reason: lý do giữ ngoại lệ
 */
interface AllowlistEntry {
  file: string;
  url?: string | RegExp;
  reason: string;
}

const ALLOWLIST: AllowlistEntry[] = [
  {
    file: "src/services/category/category.fetcher.ts",
    reason: "Các endpoint danh mục (/categories/tree, /categories, /categories/:id/children) chưa được chuẩn hóa vào API_ROUTES",
  },
  {
    file: "src/services/time/time.fetcher.ts",
    reason: "Endpoint /time/current chưa được chuẩn hóa vào API_ROUTES",
  },
];

interface Violation {
  file: string;
  line: number;
  snippet: string;
  url: string;
}

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== "__tests__") {
        walkDir(fullPath, fileList);
      }
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function findViolations(rootSrcDir: string): Violation[] {
  const files = walkDir(rootSrcDir);
  const violations: Violation[] = [];

  // Regex tìm axiosClient.<method>(...) hoặc axiosClient.<method><Generic>(...)
  // Đối số đầu tiên là chuỗi literal bắt đầu bằng /
  // Hỗ trợ generic lồng nhau và xuống dòng
  const methodRegex = /axiosClient\s*\.\s*(?:get|post|put|patch|delete)\s*(?:<[\s\S]*?>)?\s*\(\s*([`'"])\/([^`'"]*)\1/g;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");

    let match: RegExpExecArray | null;
    methodRegex.lastIndex = 0;

    while ((match = methodRegex.exec(content)) !== null) {
      const url = "/" + match[2];
      const matchIndex = match.index;
      const line = content.substring(0, matchIndex).split("\n").length;
      const snippet = match[0].trim();

      // Kiểm tra xem có nằm trong ALLOWLIST không
      const isAllowed = ALLOWLIST.some((entry) => {
        const matchesFile = relativePath === entry.file || relativePath.endsWith(entry.file);
        if (!matchesFile) return false;
        if (!entry.url) return true;
        if (typeof entry.url === "string") return entry.url === url;
        return entry.url.test(url);
      });

      if (!isAllowed) {
        violations.push({
          file: relativePath,
          line,
          snippet,
          url,
        });
      }
    }
  }

  return violations;
}

describe("No Hardcoded API Paths in axiosClient", () => {
  it("không có lời gọi axiosClient nào hardcode đường dẫn bắt đầu bằng '/'", () => {
    const srcDir = path.resolve(__dirname, "../../");
    const violations = findViolations(srcDir);

    if (violations.length > 0) {
      const errorMsg = violations
        .map(
          (v) =>
            `❌ Vi phạm hardcode URL tại ${v.file}:${v.line}\n   URL: "${v.url}"\n   Đoạn code: ${v.snippet.replace(/\r?\n\s*/g, " ")}\n`
        )
        .join("\n");

      fail(
        `Phát hiện ${violations.length} vị trí gọi axiosClient hardcode URL thay vì dùng API_ROUTES:\n\n${errorMsg}\n` +
          `-> Hãy chuyển sang dùng API_ROUTES.* trong src/constants/routes.constants.ts, hoặc thêm vào ALLOWLIST trong file test này nếu có lý do chính đáng.`
      );
    }

    expect(violations).toEqual([]);
  });
});
