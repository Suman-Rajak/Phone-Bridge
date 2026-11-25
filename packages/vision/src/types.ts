export type Point = { x: number; y: number };
export type Corners = [Point, Point, Point, Point];
export type Frame = { width: number; height: number; data: Uint8ClampedArray };
export type DetectionMode = "preview" | "refine";
export type Detection = { corners: Corners; fallback: boolean };
