import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** 気球の空の上に重ねる、すりガラスのポップアップ。後ろの空は暗くしない。 */
export function GlassDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      showCloseButton={false}
      overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-none"
      // デザインに説明文はないので、Radix の説明文がないという警告を止める。
      aria-describedby={undefined}
      className={cn(
        "w-[calc(100%-2rem)] max-w-sm rounded-xl bg-white/45 p-4 text-neutral-900 shadow-lg ring-1 ring-white/50 backdrop-blur-md sm:max-w-sm",
        className,
      )}
      {...props}
    />
  );
}
