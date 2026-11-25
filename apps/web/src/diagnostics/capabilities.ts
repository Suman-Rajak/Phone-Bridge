type CapabilityEnvironment = {
  isSecureContext?: boolean;
  navigator?: {
    mediaDevices?: { getUserMedia?: unknown };
    clipboard?: { readText?: unknown; writeText?: unknown };
    gpu?: { requestAdapter?: unknown };
  };
  document?: {
    createElement(tag: "canvas"): { getContext(type: "webgl2"): unknown };
  };
  ImageCapture?: unknown;
  RelativeOrientationSensor?: unknown;
  DeviceOrientationEvent?: unknown;
  ondeviceorientation?: unknown;
  showSaveFilePicker?: unknown;
  documentPictureInPicture?: { requestWindow?: unknown };
};

function canUseWebGL2({ document }: CapabilityEnvironment): boolean {
  try {
    return Boolean(document?.createElement("canvas").getContext("webgl2"));
  } catch {
    // Some browsers throw when policy or graphics settings block context creation.
    return false;
  }
}

const checks = [
  {
    id: "camera",
    requiresSecureContext: true,
    available: ({ navigator }) =>
      typeof navigator?.mediaDevices?.getUserMedia === "function",
  },
  {
    id: "image-capture",
    requiresSecureContext: true,
    available: ({ ImageCapture }) => typeof ImageCapture === "function",
  },
  {
    id: "relative-orientation",
    requiresSecureContext: true,
    available: ({ RelativeOrientationSensor }) =>
      typeof RelativeOrientationSensor === "function",
  },
  {
    id: "device-orientation",
    requiresSecureContext: true,
    available: (environment) =>
      typeof environment.DeviceOrientationEvent === "function" ||
      "ondeviceorientation" in environment,
  },
  {
    id: "clipboard-read",
    requiresSecureContext: true,
    available: ({ navigator }) =>
      typeof navigator?.clipboard?.readText === "function",
  },
  {
    id: "clipboard-write",
    requiresSecureContext: true,
    available: ({ navigator }) =>
      typeof navigator?.clipboard?.writeText === "function",
  },
  {
    id: "file-system",
    requiresSecureContext: true,
    available: ({ showSaveFilePicker }) =>
      typeof showSaveFilePicker === "function",
  },
  {
    id: "webgl2",
    requiresSecureContext: false,
    available: canUseWebGL2,
  },
  {
    id: "webgpu",
    requiresSecureContext: true,
    available: ({ navigator }) =>
      typeof navigator?.gpu?.requestAdapter === "function",
  },
  {
    id: "document-picture-in-picture",
    requiresSecureContext: true,
    available: ({ documentPictureInPicture }) =>
      typeof documentPictureInPicture?.requestWindow === "function",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  requiresSecureContext: boolean;
  available(environment: CapabilityEnvironment): boolean;
}>;

export type CapabilityId = (typeof checks)[number]["id"];
export type CapabilityStatus = "available" | "unavailable" | "needs-https";

export function inspectCapabilities(environment: CapabilityEnvironment) {
  const secure = environment.isSecureContext === true;
  const capabilities = checks.map(
    ({ id, requiresSecureContext, available }) => {
      if (requiresSecureContext && !secure)
        return { id, status: "needs-https" as const };
      return {
        id,
        status: available(environment)
          ? ("available" as const)
          : ("unavailable" as const),
      };
    },
  );

  return { secure, capabilities };
}
