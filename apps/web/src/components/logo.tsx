import logoMark from "@/assets/logo-mark.svg";
import logoWordmark from "@/assets/logo-wordmark.svg";
import { cn } from "@/lib/utils";

/** 気球のマークと「Fllooat」の文字を横に並べたロゴ。幅に合わせて縮む。 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex w-full max-w-[333px] items-center justify-between", className)}>
      <img src={logoMark} alt="" className="w-[20.4%]" />
      <img src={logoWordmark} alt="Fllooat" className="w-[71.8%]" />
    </span>
  );
}
