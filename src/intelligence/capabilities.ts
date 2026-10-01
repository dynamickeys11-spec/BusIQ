import type { CapabilityRequirement } from "./types.js";

export type CapabilityInput = {
  name: string;
  required: boolean;
  description: string;
};

export type CapabilityOutput = {
  name: string;
  description: string;
};

export type CapabilityDescriptor = {
  id: string;
  label: string;
  purpose: string;
  inputs: CapabilityInput[];
  outputs: CapabilityOutput[];
  requirements: string[];
  evidencePolicy: "none" | "optional" | "required";
  sideEffects: "none" | "read" | "write";
  dependencies: string[];
  suitableTools: string[];
  status: "available" | "unavailable";
};

const readBusinessInputs = [
  { name: "businessId", required: true, description: "Authorized business scope." },
];

const registry: CapabilityDescriptor[] = [
  {
    id:"business-context", label:"Business context", purpose:"Resolve the business and local context needed for execution.",
    inputs:[], outputs:[{name:"context",description:"Resolved business context."}], requirements:[], evidencePolicy:"optional", sideEffects:"read", dependencies:[], suitableTools:["local-context"], status:"available"
  },
  {
    id:"planning", label:"Planning", purpose:"Create a plan from the user's goal, constraints, assumptions and available evidence.",
    inputs:[{name:"goal",required:true,description:"Desired outcome."}], outputs:[{name:"plan",description:"Structured actionable plan."}], requirements:[], evidencePolicy:"optional", sideEffects:"none", dependencies:["business-context"], suitableTools:["local-plan-builder"], status:"available"
  },
  {
    id:"business-data-retrieval", label:"Business data retrieval", purpose:"Retrieve connected business records within authorized scope.",
    inputs:readBusinessInputs, outputs:[{name:"records",description:"Normalized business records with provenance."}], requirements:["authorized business access"], evidencePolicy:"required", sideEffects:"read", dependencies:["business-context"], suitableTools:["business-data-connector"], status:"unavailable"
  },
  ...([
    ["sales","Sales","sales performance evidence"],["customers","Customers","customer records and evidence"],["money","Money","cash, revenue and financial movements"],["expenses","Expenses","expense records"],["products","Products","product records"],["inventory","Inventory","inventory records"],["suppliers","Suppliers","supplier records"],["people","People","people and workforce records"],["operations","Operations","operational records"],["marketing","Marketing","marketing performance evidence"],["projects","Projects","project and work evidence"],
  ] as const).map(([id,label,desc]) => ({
    id, label, purpose:`Retrieve and work with connected ${desc}.`, inputs:readBusinessInputs,
    outputs:[{name:"records",description:`Normalized ${label.toLowerCase()} records with provenance.`}],
    requirements:["authorized business access"], evidencePolicy:"required" as const, sideEffects:"read" as const, dependencies:["business-data-retrieval"],
    suitableTools:["business-data-connector"], status:"unavailable" as const
  })),
  {
    id:"business-analysis", label:"Business analysis", purpose:"Analyze verified or appropriately qualified business evidence.",
    inputs:[{name:"evidence",required:true,description:"Relevant business evidence."}], outputs:[{name:"findings",description:"Evidence-linked findings and limitations."}],
    requirements:["relevant business evidence"], evidencePolicy:"required", sideEffects:"none", dependencies:["business-data-retrieval"], suitableTools:["business-analysis-tool"], status:"unavailable"
  },
  {
    id:"comparison", label:"Comparison", purpose:"Compare verified entities or options against explicit criteria and expose trade-offs.",
    inputs:[{name:"options",required:true,description:"Options or entities to compare."},{name:"criteria",required:false,description:"User-provided or explicitly established criteria."}],
    outputs:[{name:"comparison",description:"Differences, trade-offs and unknowns."}], requirements:[], evidencePolicy:"optional", sideEffects:"none", dependencies:[], suitableTools:["comparison-tool"], status:"unavailable"
  },
  {
    id:"evidence-review", label:"Evidence review", purpose:"Review, validate and reconcile evidence before factual conclusions.",
    inputs:[{name:"evidence",required:true,description:"Evidence set to assess."}], outputs:[{name:"assessment",description:"Quality, completeness, conflicts and sufficiency."}],
    requirements:["evidence set"], evidencePolicy:"required", sideEffects:"none", dependencies:[], suitableTools:["evidence-review-tool"], status:"unavailable"
  },
  {
    id:"content-generation", label:"Content generation", purpose:"Generate requested business content from sufficient context without inventing facts.",
    inputs:[{name:"brief",required:true,description:"Requested content outcome."}], outputs:[{name:"content",description:"Requested business content."}], requirements:[], evidencePolicy:"optional", sideEffects:"none", dependencies:[], suitableTools:["content-generation-tool"], status:"unavailable"
  },
  {
    id:"explanation", label:"Explanation", purpose:"Explain a subject clearly while separating facts, inferences and unknowns.",
    inputs:[{name:"subject",required:true,description:"Subject to explain."}], outputs:[{name:"explanation",description:"Clear explanation with limitations where relevant."}], requirements:[], evidencePolicy:"optional", sideEffects:"none", dependencies:[], suitableTools:["explanation-tool"], status:"available"
  },
  {
    id:"monitoring", label:"Monitoring", purpose:"Track a defined condition and surface changes or alerts.",
    inputs:[{name:"condition",required:true,description:"Condition to monitor."}], outputs:[{name:"observations",description:"Observed changes or alerts."}], requirements:["connected data source"], evidencePolicy:"required", sideEffects:"read", dependencies:["business-data-retrieval"], suitableTools:["monitoring-tool"], status:"unavailable"
  },
  {
    id:"external-research", label:"External research", purpose:"Retrieve current external evidence from configured sources.",
    inputs:[{name:"researchQuestion",required:true,description:"Question requiring external evidence."}], outputs:[{name:"sources",description:"Current external evidence with provenance."}],
    requirements:["configured research source"], evidencePolicy:"required", sideEffects:"read", dependencies:[], suitableTools:["external-research-connector"], status:"unavailable"
  },
];

const registryById = new Map(registry.map(item => [item.id, item]));

export function listCapabilities(): CapabilityDescriptor[] {
  return registry.map(item => ({
    ...item,
    inputs: item.inputs.map(input => ({ ...input })),
    outputs: item.outputs.map(output => ({ ...output })),
    requirements: [...item.requirements],
    dependencies: [...item.dependencies],
    suitableTools: [...item.suitableTools],
  }));
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
