import type { CapabilityRequirement } from "./types.js";

export type CapabilityDescriptor = {
  id: string;
  label: string;
  purpose: string;
  suitableTools: string[];
  status: "available" | "unavailable";
};

const registry: CapabilityDescriptor[] = [
  { id:"intent-resolution", label:"Intent resolution", purpose:"Determine what outcome the request asks for.", suitableTools:["deterministic-intent"], status:"available" },
  { id:"business-context", label:"Business context", purpose:"Resolve the business and local context needed for execution.", suitableTools:["local-context"], status:"available" },
  { id:"planning", label:"Planning", purpose:"Create a deterministic plan structure without inventing facts.", suitableTools:["local-plan-builder"], status:"available" },
  { id:"business-data-retrieval", label:"Business data retrieval", purpose:"Retrieve connected business records.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"sales", label:"Sales", purpose:"Retrieve and work with connected sales records and sales performance evidence.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"customers", label:"Customers", purpose:"Retrieve and work with connected customer records and customer evidence.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"money", label:"Money", purpose:"Retrieve and work with connected money records such as cash, revenue, and financial movements.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"expenses", label:"Expenses", purpose:"Retrieve and work with connected expense records.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"products", label:"Products", purpose:"Retrieve and work with connected product records.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"inventory", label:"Inventory", purpose:"Retrieve and work with connected inventory records.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"suppliers", label:"Suppliers", purpose:"Retrieve and work with connected supplier records.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"people", label:"People", purpose:"Retrieve and work with connected people and workforce records.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"operations", label:"Operations", purpose:"Retrieve and work with connected operational records.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"marketing", label:"Marketing", purpose:"Retrieve and work with connected marketing records and performance evidence.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"projects", label:"Projects", purpose:"Retrieve and work with connected project records and work evidence.", suitableTools:["business-data-connector"], status:"unavailable" },
  { id:"business-analysis", label:"Business analysis", purpose:"Analyze connected business records.", suitableTools:["business-analysis-tool"], status:"unavailable" },
  { id:"comparison", label:"Comparison", purpose:"Compare verified entities or options against explicit criteria.", suitableTools:["comparison-tool"], status:"unavailable" },
  { id:"evidence-review", label:"Evidence review", purpose:"Review, validate and reconcile evidence.", suitableTools:["evidence-review-tool"], status:"unavailable" },
  { id:"content-generation", label:"Content generation", purpose:"Generate requested business content from sufficient context and evidence.", suitableTools:["content-generation-tool"], status:"unavailable" },
  { id:"explanation", label:"Explanation", purpose:"Explain a subject clearly without overstating evidence.", suitableTools:["explanation-tool"], status:"available" },
  { id:"monitoring", label:"Monitoring", purpose:"Track a condition and surface changes or alerts.", suitableTools:["monitoring-tool"], status:"unavailable" },
  { id:"external-research", label:"External research", purpose:"Retrieve current external evidence from configured sources.", suitableTools:["external-research-connector"], status:"unavailable" },
];

const registryById = new Map(registry.map(item => [item.id, item]));

export function listCapabilities(): CapabilityDescriptor[] {
  return registry.map(item => ({ ...item, suitableTools: [...item.suitableTools] }));
}

export function getCapability(id: string): CapabilityDescriptor | undefined {
  return registryById.get(id);
}

export function describeCapabilities(ids: string[], needsBusinessData: boolean, needsExternalResearch: boolean): CapabilityRequirement[] {
  const required = new Set(ids);
  if (needsBusinessData) required.add("business-data-retrieval");
  if (needsExternalResearch) required.add("external-research");
  return [...required].map(id => {
    const capability = getCapability(id);
    return {
      id,
      reason: capability?.purpose ?? id,
      status: capability?.status ?? "unavailable",
    };
  });
}

export function capabilityLabel(id: string): string {
  return getCapability(id)?.label ?? id;
}
