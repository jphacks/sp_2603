import { useState } from "react";
import { GlassDialogContent } from "@/components/glass-dialog";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

const TITLE_MAX_LENGTH = 30;
const DEFAULT_WEIGHT = 50;

type AddTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** まだ乗せられる重さ (%)。スライダーの上限になる。 */
  remaining: number;
  onAdd: (title: string, weight: number) => void;
};

export function AddTaskDialog({ open, onOpenChange, remaining, onAdd }: AddTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <GlassDialogContent>
        <DialogTitle className="sr-only">タスクをのせる</DialogTitle>
        {/* 開くたびに入力を空に戻すため、開いている間だけ中身を作る。 */}
        {open && <AddTaskForm remaining={remaining} onAdd={onAdd} />}
      </GlassDialogContent>
    </Dialog>
  );
}

function AddTaskForm({ remaining, onAdd }: Pick<AddTaskDialogProps, "remaining" | "onAdd">) {
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState(Math.min(DEFAULT_WEIGHT, remaining));
  const canAdd = title.trim() !== "" && remaining > 0;

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canAdd) onAdd(title.trim(), weight);
      }}
    >
      <label className="grid gap-2">
        <span className="text-sm font-bold">タスク名</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={TITLE_MAX_LENGTH}
          placeholder="新規タスク"
          className="h-10 rounded-md bg-white px-3 text-base outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
        />
      </label>
      <div className="grid gap-3">
        <span className="text-sm font-bold">タスクの重さ</span>
        {remaining > 0 ? (
          <>
            <Slider
              min={1}
              max={remaining}
              step={1}
              value={[weight]}
              onValueChange={([value]) => value !== undefined && setWeight(value)}
              aria-label="タスクの重さ"
              className="py-2 **:data-[slot=slider-range]:bg-[#0A84FF] **:data-[slot=slider-thumb]:size-6 **:data-[slot=slider-thumb]:border-2 **:data-[slot=slider-thumb]:border-neutral-900 **:data-[slot=slider-track]:h-1.5 **:data-[slot=slider-track]:bg-white"
            />
            <span className="text-center text-sm">{weight}%</span>
          </>
        ) : (
          <span className="text-sm">これ以上はのせられません</span>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canAdd}
          className="h-10 rounded-md bg-[#0057E0] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          追加
        </button>
      </div>
    </form>
  );
}
