import { useEffect } from "react";

interface AlertProps {
  message: string;
  type?: "error" | "success";
  onClose: () => void;
  duration?: number; // ms
}

export default function Alert({
  message,
  type = "error",
  onClose,
  duration = 3000,
}: AlertProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div
    className={`
        absolute top-0 left-0 w-full z-50
        px-4 pt-4
    `}
    >
        <div
            className={`
            w-full
            px-6 py-3 rounded-2xl shadow-lg
            text-sm font-semibold
            transition-all
            ${
                type === "error"
                ? "bg-red-500 text-white"
                : "bg-green-500 text-white"
            }
            `}
        >
            {message}
        </div>
    </div>
  );
}