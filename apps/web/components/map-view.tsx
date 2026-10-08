"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, ShieldCheck } from "lucide-react";
import type { Map as LibreMap, Marker } from "maplibre-gl";
import type { Point, PublicReport } from "../../../packages/domain/src/index";
import { useI18n } from "./context";
import { api } from "../lib/client";
import { statusKey } from "./ui";
export function MapView({
  reports = [],
  point,
  onPoint,
  height,
  onSelect,
}: {
  reports?: PublicReport[];
  point?: Point;
  onPoint?: (p: Point) => void;
  height?: number;
  onSelect?: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const onPointRef = useRef(onPoint);
  onPointRef.current = onPoint;
  useEffect(() => {
    let cancelled = false;
    // Include library loading and renderer startup in the fallback deadline.
    const timeout = setTimeout(() => {
      if (!cancelled) setFallback(true);
    }, 9000);
    async function init() {
      try {
        const [lib, config] = await Promise.all([
          import("maplibre-gl"),
          api<{ mapTileUrl: string | null; mapAttribution: string | null }>(
            "config",
          ).catch(() => ({ mapTileUrl: null, mapAttribution: null })),
        ]);
        if (cancelled || !container.current) return;
        const instance = new lib.Map({
          container: container.current,
          style: {
            version: 8,
            sources: {
              basemap: {
                type: "raster",
                tiles: [
                  config.mapTileUrl ||
                    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                ],
                tileSize: 256,
                attribution:
                  config.mapAttribution ||
                  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
              },
            },
            layers: [{ id: "basemap", type: "raster", source: "basemap" }],
          },
          center: point ? [point.lng, point.lat] : [90.387, 23.741],
          zoom: point ? 15 : 13.7,
          minZoom: 11,
          maxZoom: 18,
          attributionControl: { compact: false },
        });
        map.current = instance;
        instance.addControl(
          new lib.NavigationControl({ showCompass: false }),
          "top-right",
        );
        instance.on("load", () => {
          if (!cancelled) {
            setReady(true);
            if (timeout) clearTimeout(timeout);
          }
        });
        instance.on("click", (e) => {
          onPointRef.current?.({
            lat: Number(e.lngLat.lat.toFixed(6)),
            lng: Number(e.lngLat.lng.toFixed(6)),
          });
        });
        instance.on("error", () => {
          if (!cancelled) setFallback(true);
        });
      } catch {
        if (!cancelled) setFallback(true);
      }
    }
    if (navigator.onLine) void init();
    else setFallback(true);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
    // Initialize once per locale; markers and private pin update separately.
  }, [locale]);
  useEffect(() => {
    if (!ready || !map.current) return;
    let cancelled = false;
    import("maplibre-gl").then((lib) => {
      if (cancelled || !map.current) return;
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      for (const r of reports) {
        const el = document.createElement("button");
        el.className = "map-marker " + r.status;
        el.setAttribute(
          "aria-label",
          t(r.category) + " · " + t(statusKey[r.status]) + " · " + r.publicId,
        );
        const dot = document.createElement("span");
        el.append(dot);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          if (onSelect) onSelect(r.publicId);
          else window.location.href = `/${locale}/r/${r.publicId}`;
        });
        markers.current.push(
          new lib.Marker({ element: el, anchor: "bottom" })
            .setLngLat([r.publicLocation.lng, r.publicLocation.lat])
            .addTo(map.current),
        );
      }
      if (point) {
        const el = document.createElement("div");
        el.className = "map-marker current";
        el.append(document.createElement("span"));
        const privateMarker = new lib.Marker({
          element: el,
          draggable: !!onPointRef.current,
          anchor: "bottom",
        })
          .setLngLat([point.lng, point.lat])
          .addTo(map.current);
        privateMarker.on("dragend", (event) => {
          const p = (event.target as Marker).getLngLat();
          onPointRef.current?.({
            lat: Number(p.lat.toFixed(6)),
            lng: Number(p.lng.toFixed(6)),
          });
        });
        markers.current.push(privateMarker);
        map.current.easeTo({ center: [point.lng, point.lat], duration: 0 });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, reports, point, locale, onSelect, t]);
  return (
    <div
      className="map-container"
      role="region"
      aria-label={t("mapLabel")}
      style={height ? { height } : undefined}
    >
      <div
        ref={container}
        className="map-canvas"
        aria-hidden={fallback}
        style={{ visibility: fallback ? "hidden" : "visible" }}
      />
      {fallback && (
        <>
          <svg
            className="schematic-svg"
            viewBox="0 0 700 450"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="blocks"
                width="64"
                height="45"
                patternTransform="rotate(-14)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="64" height="45" fill="#eceee4" />
                <rect
                  x="4"
                  y="4"
                  width="53"
                  height="34"
                  fill="#e2e7dc"
                  rx="3"
                />
                <path d="M0 42H64M61 0V45" stroke="#fff" strokeWidth="5" />
              </pattern>
            </defs>
            <rect width="700" height="450" fill="url(#blocks)" />
            <path
              d="M225-10q-60 80-23 160t-25 155-65 170"
              fill="none"
              stroke="#c3ddd3"
              strokeWidth="44"
            />
            <path
              d="M-40 150 740 330M420-20 300 490M-30 340 740 120"
              fill="none"
              stroke="#d6dac9"
              strokeWidth="18"
            />
            <path
              d="M-40 150 740 330M420-20 300 490M-30 340 740 120"
              fill="none"
              stroke="#fffdf1"
              strokeWidth="12"
            />
            <rect
              x="433"
              y="185"
              width="100"
              height="65"
              rx="16"
              fill="#cbdcbd"
              transform="rotate(-14 483 215)"
            />
            <rect
              x="42"
              y="48"
              width="90"
              height="55"
              rx="13"
              fill="#d2dfc4"
              transform="rotate(-14 88 75)"
            />
          </svg>
          <div className="schematic-markers">
            {reports.map((r, i) => (
              <button
                key={r.publicId}
                className={"map-marker " + r.status}
                style={{
                  left: `${15 + ((i * 17) % 70)}%`,
                  top: `${20 + ((i * 13) % 58)}%`,
                }}
                aria-label={`${t(r.category)} · ${t(statusKey[r.status])}`}
                onClick={() =>
                  onSelect
                    ? onSelect(r.publicId)
                    : window.location.assign(`/${locale}/r/${r.publicId}`)
                }
              >
                <span />
              </button>
            ))}
            {point && (
              <div
                className="map-marker current"
                style={{ left: "50%", top: "50%" }}
              >
                <span />
              </div>
            )}
          </div>
        </>
      )}
      <div className="map-label">
        <MapPin size={12} />
        {fallback ? t("schematic") : t(onPoint ? "pinHelp" : "demoShort")}
      </div>
      {!onPoint && (
        <div className="map-legend">
          <span>
            <i className="dot" />
            {t("reported")}
          </span>
          <span>
            <i className="dot working" />
            {t("working")}
          </span>
          <span>
            <i className="dot resolved" />
            {t("resolved")}
          </span>
        </div>
      )}
      {fallback && <span className="sr-only">{t("mapUnavailable")}</span>}
      {onPoint && (
        <div className="map-legend">
          <ShieldCheck size={12} />
          {t("locationHelp")}
        </div>
      )}
    </div>
  );
}
