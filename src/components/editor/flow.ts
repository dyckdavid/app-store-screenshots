export type FlowStep =
  | "upload"
  | "devices"
  | "style"
  | "review"
  | "export";

export const FLOW_STEPS: {
  id: FlowStep;
  label: string;
  hint: string;
}[] = [
  { id: "upload", label: "Upload", hint: "Screenshots" },
  { id: "devices", label: "Devices", hint: "Layout + sizes" },
  { id: "style", label: "Style", hint: "Caption + look" },
  { id: "review", label: "AI review", hint: "Copy + score" },
  { id: "export", label: "Export", hint: "PNG + ZIP" },
];
