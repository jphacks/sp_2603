import { useCallback, useEffect, useRef, useState } from "react";
import { createShakeDetector, DEVICE_SHAKE } from "@/lib/shake-detector";

/**
 * - `prompt`: iPhone などで、ボタンを押して許可を取る必要がある
 * - `granted`: 揺れを検出している
 * - `denied`: 許可されなかった
 * - `unsupported`: センサーがない、または HTTPS でない
 */
export type MotionPermission = "prompt" | "granted" | "denied" | "unsupported";

// iOS の Safari だけにある API で、TypeScript の DOM の型には含まれていない。
type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const initialPermission = (): MotionPermission => {
  if (typeof DeviceMotionEvent === "undefined" || !window.isSecureContext) return "unsupported";
  const { requestPermission } = DeviceMotionEvent as DeviceMotionEventWithPermission;
  return requestPermission ? "prompt" : "granted";
};

/**
 * スマホを左右に強く振ったら onShake を呼ぶ。
 * iPhone では `permission` が `prompt` の間は動かないので、ボタンの onClick で `requestPermission` を呼ぶ。
 */
export function useDeviceShake(onShake: () => void) {
  const [permission, setPermission] = useState(initialPermission);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  const requestPermission = useCallback(async () => {
    const { requestPermission } = DeviceMotionEvent as DeviceMotionEventWithPermission;
    if (!requestPermission) return;
    try {
      setPermission(await requestPermission());
    } catch {
      setPermission("denied");
    }
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;
    const feed = createShakeDetector(DEVICE_SHAKE, () => onShakeRef.current());
    // 重力を除いた加速度が取れない端末では、重力込みの値で代わりにする。
    const handleMotion = (event: DeviceMotionEvent) => {
      const x = event.acceleration?.x ?? event.accelerationIncludingGravity?.x;
      if (x != null) feed(x);
    };
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [permission]);

  return { permission, requestPermission };
}
