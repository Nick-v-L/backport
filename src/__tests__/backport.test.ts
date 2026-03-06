import { exportedForTesting } from "../backport";

const { handleCustomInput } = exportedForTesting;

describe("handleCustomInput", () => {
  test("should return empty array for empty string", () => {
    expect(handleCustomInput("")).toEqual([]);
  });

  test("should split single word", () => {
    expect(handleCustomInput("word")).toEqual(["word"]);
  });

  test("should split comma separated values", () => {
    expect(handleCustomInput("a,b,c")).toEqual(["a", "b", "c"]);
  });

  test("should split space separated values", () => {
    expect(handleCustomInput("a b c")).toEqual(["a", "b", "c"]);
  });

  test("should split mixed separators", () => {
    expect(handleCustomInput("a, b c")).toEqual(["a", "b", "c"]);
  });

  test("should handle extra spaces and empty parts", () => {
    expect(handleCustomInput(" a , b  c ")).toEqual(["a", "b", "c"]);
  });

  test("should filter out empty strings from multiple separators", () => {
    expect(handleCustomInput(",a,,b,")).toEqual(["a", "b"]);
  });

  test("should handle tabs and newlines", () => {
    expect(handleCustomInput("a\tb\nc")).toEqual(["a", "b", "c"]);
  });
});
