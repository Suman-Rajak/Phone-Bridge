import { expect, test, vi } from "vitest";
import { inspectCapabilities } from "./capabilities";
import type { CapabilityId } from "./capabilities";

type Environment = Parameters<typeof inspectCapabilities>[0];

const gatedApi = vi.fn(() => {
  throw new Error("Diagnostics must not invoke protected APIs");
});
const cases = [
  ["camera", { navigator: { mediaDevices: { getUserMedia: gatedApi } } }],
  ["image-capture", { ImageCapture: gatedApi }],
  ["relative-orientation", { RelativeOrientationSensor: gatedApi }],
  ["device-orientation", { DeviceOrientationEvent: gatedApi }],
  ["clipboard-read", { navigator: { clipboard: { readText: gatedApi } } }],
  ["clipboard-write", { navigator: { clipboard: { writeText: gatedApi } } }],
  ["file-system", { showSaveFilePicker: gatedApi }],
  [
    "webgl2",
    { document: { createElement: () => ({ getContext: () => ({}) }) } },
  ],
  ["webgpu", { navigator: { gpu: { requestAdapter: gatedApi } } }],
  [
    "document-picture-in-picture",
    { documentPictureInPicture: { requestWindow: gatedApi } },
  ],
] satisfies readonly [CapabilityId, Environment][];

test.each(cases)("%s reports exposed and missing APIs", (id, environment) => {
  expect(
    inspectCapabilities({ ...environment, isSecureContext: true }).capabilities,
  ).toContainEqual({
    id,
    status: "available",
  });
  expect(
    inspectCapabilities({ isSecureContext: true }).capabilities,
  ).toContainEqual({
    id,
    status: "unavailable",
  });
  expect(gatedApi).not.toHaveBeenCalled();
});

test.each(cases)(
  "%s reports the status on an insecure origin",
  (id, environment) => {
    const report = inspectCapabilities({
      ...environment,
      isSecureContext: false,
    });

    expect(report.secure).toBe(false);
    expect(report.capabilities).toContainEqual({
      id,
      status: id === "webgl2" ? "available" : "needs-https",
    });
    expect(gatedApi).not.toHaveBeenCalled();
  },
);

test("accepts the deviceorientation event handler without an exposed constructor", () => {
  expect(
    inspectCapabilities({ isSecureContext: true, ondeviceorientation: null })
      .capabilities,
  ).toContainEqual({ id: "device-orientation", status: "available" });
});

test("checks clipboard read and write independently", () => {
  const navigator = { clipboard: { readText: gatedApi, writeText: true } };

  expect(
    inspectCapabilities({ isSecureContext: true, navigator }).capabilities,
  ).toEqual(
    expect.arrayContaining([
      { id: "clipboard-read", status: "available" },
      { id: "clipboard-write", status: "unavailable" },
    ]),
  );
});

test.each([
  ["returns null", () => null],
  [
    "throws",
    () => {
      throw new Error("Graphics disabled");
    },
  ],
])(
  "WebGL2 is unavailable when context creation %s",
  (_label, getContextImplementation) => {
    const getContext = vi.fn(getContextImplementation);
    const createElement = vi.fn(() => ({ getContext }));

    expect(
      inspectCapabilities({ document: { createElement } }).capabilities,
    ).toContainEqual({ id: "webgl2", status: "unavailable" });
    expect(createElement).toHaveBeenCalledExactlyOnceWith("canvas");
    expect(getContext).toHaveBeenCalledExactlyOnceWith("webgl2");
  },
);
