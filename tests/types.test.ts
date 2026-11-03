
import { describe, expect, it, vi } from "vitest";
import {
    assertNever,
    mapAsyncState,
    type AsyncState,
} from "../src/types.js";

describe("mapAsyncState", () => {
    it("transforms data in a success state", () => {
        const state: AsyncState<number> = {
            status: "success",
            data: 5,
        };

        expect(mapAsyncState(state, (value) => value * 2)).toEqual({
            status: "success",
            data: 10,
        });
    });

    it("preserves the loading state", () => {
        const state: AsyncState<number> = { status: "loading" };

        expect(mapAsyncState(state, (value) => String(value))).toEqual({
            status: "loading",
        });
    });

    it("preserves the empty state", () => {
        const state: AsyncState<number> = { status: "empty" };

        expect(mapAsyncState(state, (value) => String(value))).toEqual({
            status: "empty",
        });
    });

    it("preserves the error state", () => {
        const state: AsyncState<number> = {
            status: "error",
            message: "Request failed",
        };

        expect(mapAsyncState(state, (value) => String(value))).toEqual({
            status: "error",
            message: "Request failed",
        });
    });

    it("does not call the transform for non-success states", () => {
        const transform = vi.fn((value: number) => value * 2);

        mapAsyncState({ status: "loading" }, transform);
        mapAsyncState({ status: "empty" }, transform);
        mapAsyncState({ status: "error", message: "Failed" }, transform);

        expect(transform).not.toHaveBeenCalled();
    });
});

describe("assertNever", () => {
    it("throws when called with an unexpected value", () => {
        expect(() => assertNever("unexpected" as never)).toThrow(
            "Unexpected value",
        );
    });
});
