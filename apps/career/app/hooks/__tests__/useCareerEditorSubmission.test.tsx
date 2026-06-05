import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCareerEditorSubmission } from "../useCareerEditorSubmission";

describe("useCareerEditorSubmission", () => {
  it("shows a success toast for a successful save", () => {
    const addToast = vi.fn();

    const { rerender } = renderHook(
      ({ fetcher }: { fetcher: { state: string; data: unknown } }) =>
        useCareerEditorSubmission({
          fetcher: fetcher as never,
          addToast,
          successMessage: "Saved",
          errorMessage: "Failed to save",
          isNew: false,
        }),
      {
        initialProps: {
          fetcher: { state: "submitting", data: undefined as unknown },
        },
      },
    );

    rerender({
      fetcher: {
        state: "idle",
        data: { success: true, message: "Project updated successfully" },
      },
    });

    expect(addToast).toHaveBeenCalledWith(
      "Project updated successfully",
      "success",
    );
  });

  it("shows an error toast for a failed save", () => {
    const addToast = vi.fn();

    renderHook(() =>
      useCareerEditorSubmission({
        fetcher: {
          state: "idle",
          data: { success: false, error: "Validation failed" },
        } as never,
        addToast,
        successMessage: "Saved",
        errorMessage: "Failed to save",
        isNew: false,
      }),
    );

    expect(addToast).toHaveBeenCalledWith(
      "Failed to save: Validation failed",
      "error",
    );
  });

  it("calls the create callback with returned data for new records", () => {
    const addToast = vi.fn();
    const onCreateSuccess = vi.fn();

    renderHook(() =>
      useCareerEditorSubmission({
        fetcher: {
          state: "idle",
          data: { success: true, data: { id: "project-1" } },
        } as never,
        addToast,
        successMessage: "Saved",
        errorMessage: "Failed to save",
        isNew: true,
        onCreateSuccess,
      }),
    );

    expect(onCreateSuccess).toHaveBeenCalledWith({ id: "project-1" });
  });
});
