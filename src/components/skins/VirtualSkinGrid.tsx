import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SkinCard } from "./SkinCard";
import type { Skin } from "@/types/champion";
import type { GridDensity } from "@/types/settings";
import { useSettingsStore } from "@/store/settingsStore";
import { useSelectionStore } from "@/store/selectionStore";

interface VirtualSkinGridProps {
  skins: Skin[];
  emptyState?: React.ReactNode;
}

const DENSITY_SPEC: Record<
  GridDensity,
  { minWidth: number; gap: number; textHeight: number }
> = {
  compact: { minWidth: 132, gap: 10, textHeight: 50 },
  comfortable: { minWidth: 168, gap: 12, textHeight: 50 },
  large: { minWidth: 220, gap: 14, textHeight: 50 },
};

const OVERSCAN_ROWS = 3;
const VIRTUAL_THRESHOLD = 60;

export function VirtualSkinGrid({ skins, emptyState }: VirtualSkinGridProps) {
  const density = useSettingsStore((s) => s.settings.gridDensity);
  const spec = DENSITY_SPEC[density];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const selectionActive = useSelectionStore((s) => s.active);
  const selectedIds = useSelectionStore((s) => s.ids);
  const toggle = useSelectionStore((s) => s.toggle);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      setViewportWidth(node.clientWidth);
      setViewportHeight(node.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    const node = containerRef.current;
    if (node) setScrollTop(node.scrollTop);
  }, []);

  useEffect(() => {
    setScrollTop(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [skins.length]);

  const padding = 14;
  const innerWidth = Math.max(0, viewportWidth - padding * 2);
  const columns = Math.max(
    1,
    Math.floor((innerWidth + spec.gap) / (spec.minWidth + spec.gap)),
  );
  const cardWidth =
    columns > 0
      ? (innerWidth - spec.gap * (columns - 1)) / columns
      : innerWidth;
  const imageHeight = Math.round(cardWidth / 2);
  const rowHeight = imageHeight + spec.textHeight + spec.gap;
  const totalRows = Math.ceil(skins.length / columns);
  const totalHeight = totalRows * rowHeight;

  const useVirtual =
    skins.length >= VIRTUAL_THRESHOLD && viewportHeight > 0 && columns > 0;

  const startRow = useVirtual
    ? Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS)
    : 0;
  const endRow = useVirtual
    ? Math.min(
        totalRows,
        Math.ceil((scrollTop + viewportHeight) / rowHeight) + OVERSCAN_ROWS,
      )
    : totalRows;

  const visible: { skin: Skin; index: number }[] = [];
  for (let row = startRow; row < endRow; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const index = row * columns + col;
      if (index < skins.length) visible.push({ skin: skins[index], index });
    }
  }

  if (skins.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="h-full overflow-y-auto overflow-x-hidden"
      style={{ contain: "strict" }}
    >
      {useVirtual ? (
        <div
          className="relative w-full"
          style={{ height: totalHeight + padding * 2 }}
        >
          <div
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${padding + startRow * rowHeight}px)` }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: spec.gap,
                paddingLeft: padding,
                paddingRight: padding,
              }}
            >
              {visible.map(({ skin, index }) => (
                <SkinCard
                  key={skin.id}
                  skin={skin}
                  index={index}
                  selectable={selectionActive}
                  selected={selectedSet.has(skin.id)}
                  onToggleSelect={() => toggle(skin.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${columns || 1}, minmax(0, 1fr))`,
            gap: spec.gap,
            padding: padding,
          }}
        >
          {skins.map((skin, index) => (
            <SkinCard
              key={skin.id}
              skin={skin}
              index={index}
              selectable={selectionActive}
              selected={selectedSet.has(skin.id)}
              onToggleSelect={() => toggle(skin.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
