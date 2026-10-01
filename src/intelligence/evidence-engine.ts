import type { EvidenceItem, EvidenceDiagnostic, EvidenceSufficiency } from "./types.js";
export type EvidenceAssessment={evidence:EvidenceItem[];diagnostics:EvidenceDiagnostic[];completeness:number;contradictions:Array<{leftId:string;rightId:string;reason:string}>;sufficiency:EvidenceSufficiency};
export function assessEvidence(evidence:EvidenceItem[],requiredDomains:string[]=[]):EvidenceAssessment{
 const diagnostics:EvidenceDiagnostic[]=[]; const contradictions:EvidenceAssessment["contradictions"]=[]; const covered=new Set<string>();
 for(const item of evidence){const label=item.label.toLowerCase();for(const d of requiredDomains)if(label.includes(d.toLowerCase()))covered.add(d);
 if(item.verification!=="verified")diagnostics.push({evidenceId:item.id,category:"verification",message:"Evidence has not been independently verified."});
 if(item.freshness==="unknown")diagnostics.push({evidenceId:item.id,category:"freshness",message:"Evidence freshness is unknown."});
 if(item.relevance==="unknown")diagnostics.push({evidenceId:item.id,category:"relevance",message:"Evidence relevance is unknown."});}
 for(let i=0;i<evidence.length;i++)for(let j=i+1;j<evidence.length;j++){const a=evidence[i],b=evidence[j];if(a.scope?.periodStart&&b.scope?.periodStart&&a.scope.periodStart===b.scope.periodStart&&a.detail!==b.detail&&a.label.toLowerCase()===b.label.toLowerCase()){contradictions.push({leftId:a.id,rightId:b.id,reason:"Same labeled evidence and period contain different details."});diagnostics.push({category:"conflict",message:"Conflicting evidence detected for "+a.label+"."});}}
 const completeness=requiredDomains.length?covered.size/requiredDomains.length:evidence.length?1:0;
 return{evidence,diagnostics,completeness,contradictions,sufficiency:!evidence.length?"insufficient":completeness<1?"insufficient":"sufficient"};
}