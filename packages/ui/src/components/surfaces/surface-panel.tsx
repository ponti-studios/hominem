import type { ComponentPropsWithoutRef, ElementType } from "react";

type SurfacePanelProps<T extends ElementType = "div"> = {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

export function SurfacePanel<T extends ElementType = "div">({
  as,
  ...props
}: SurfacePanelProps<T>) {
  const Comp = as ?? "div";

  return <Comp className="border-subtle bg-surface rounded-3xl p-5" {...props} />;
}
