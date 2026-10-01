export type DecisionMemory={id:string;decision:string;assumptions:string[];expectedOutcomes:string[];actualOutcomes:string[];decidedAt:string;reviewAt?:string;status:"planned"|"active"|"completed"|"review"};
export function createDecisionMemory(input:Omit<DecisionMemory,"status">&{status?:DecisionMemory["status"]}):DecisionMemory{return{...input,status:input.status??"planned"}}
export function evaluateDecision(memory:DecisionMemory){return{...memory,status:"review" as const,variance:memory.expectedOutcomes.length===memory.actualOutcomes.length?"comparable":"incomplete"}}
