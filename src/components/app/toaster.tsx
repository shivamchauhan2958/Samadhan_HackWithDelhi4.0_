"use client";

import { useEffect, useState } from "react";

const EVENT = "samadhan:toast";

// Fire-and-forget toast from anywhere in the app.
export function notify(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);

  useEffect(() => {
    let counter = 0;
    const onToast = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      const id = ++counter;
      setItems((list) => [...list.slice(-2), { id, text }]);
      window.setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), 3800);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div key={item.id} className="toast">
          {item.text}
        </div>
      ))}
    </div>
  );
}
