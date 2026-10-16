import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ImageOff } from "lucide-react";
import { getImageLoader } from "@/services/imageLoader";

interface LazyImageProps {
  url: string | null;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  eager?: boolean;
  objectPosition?: string;
}

type Status = "idle" | "loading" | "loaded" | "error";

export function LazyImage({
  url,
  alt,
  className,
  wrapperClassName,
  eager = false,
  objectPosition,
}: LazyImageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (eager || visible) return;
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "300px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [eager, visible]);

  useEffect(() => {
    if (!visible || !url) return;
    let alive = true;
    setStatus("loading");
    getImageLoader()
      .resolve(url)
      .then((asset) => {
        if (!alive) return;
        if (asset) {
          setSrc(asset);
          setStatus("loaded");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [visible, url]);

  return (
    <div
      ref={containerRef}
      className={clsx("relative overflow-hidden", wrapperClassName)}
    >
      {src && status !== "error" ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={clsx(
            "h-full w-full object-cover transition-opacity duration-500",
            status === "loading" ? "opacity-0" : "opacity-100",
            className,
          )}
          style={objectPosition ? { objectPosition } : undefined}
          onLoad={() => setStatus("loaded")}
        />
      ) : status === "error" ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-void-700 to-void-900 text-slate-600">
          <ImageOff className="h-8 w-8" />
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-gradient-to-br from-void-800 to-void-900" />
      )}
    </div>
  );
}
