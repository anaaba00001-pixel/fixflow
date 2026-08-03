import { describe, expect, it } from "vitest";
import { MAX_IMAGE_SIZE, validateImage } from "../../src/utils/validation";

describe("file upload validation", () => {
  it("accepts supported images", () => expect(validateImage({ type: "image/webp", size: 1024 }).valid).toBe(true));
  it("rejects executable content", () => expect(validateImage({ type: "application/x-msdownload", size: 10 }).valid).toBe(false));
  it("rejects oversized images", () => expect(validateImage({ type: "image/jpeg", size: MAX_IMAGE_SIZE + 1 }).valid).toBe(false));
});
