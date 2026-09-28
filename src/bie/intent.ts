import type { RequestContext } from "../intelligence/types";

export type IntentKind="investigate"|"compare"|"plan"|"create"|"retrieve"|"explain"|"monitor"|"unknown";
export type ResolvedIntent={kind:IntentKind;label:string;normalizedRequest:string;requiredCapabilities:string[];needsBusinessData:boolean;needsExternalResearch:boolean;ambiguity:"none"|"material";candidates?:Array<{kind:IntentKind;score:number;reasons:string[]}>;context?:RequestContext;secondaryIntents?:IntentKind[]};

const rules:Array<{kind:IntentKind;label:string;patterns:RegExp[];capabilities:string[]}>= [
{kind:"investigate",label:"Investigate a business situation",patterns:[/\bwhy\b/i,/\bdeclin/i,/\bdrop/i,/\bfall/i,/\bchanged/i,/\bcaus/i,/\binvestigat/i],capabilities:["business-analysis","evidence-review"]},
{kind:"compare",label:"Compare options or entities",patterns:[/\bcompar/i,/\bversus\b/i,/\bvs\.?\b/i,/\bwhich\b/i,/\bbetween\b/i],capabilities:["comparison","evidence-review"]},
{kind:"plan",label:"Build a plan",patterns:[/\bplan\b/i,/\broadmap\b/i,/\bstrategy\b/i,/\b90[- ]day\b/i],capabilities:["planning","business-context"]},
{kind:"create",label:"Create a business output",patterns:[/\bcreate\b/i,/\bwrite\b/i,/\bdraft\b/i,/\bprepare\b/i,/\bmake\b/i],capabilities:["content-generation","business-context"]},
{kind:"retrieve",label:"Retrieve business information",patterns:[/\bshow\b/i,/\bfind\b/i,/\blist\b/i,/\bhow much\b/i,/\bwhat is\b/i],capabilities:["business-data-retrieval"]},
{kind:"explain",label:"Explain something",patterns:[/\bexplain\b/i,/\bteach\b/i,/\bhelp me understand\b/i],capabilities:["explanation"]},
{kind:"monitor",label:"Monitor a business condition",patterns:[/\bmonitor\b/i,/\btrack\b/i,/\bwatch\b/i,/\balert\b/i],capabilities:["monitoring","business-context"]}];

const currentBusiness=/\b(my|our|this|current|today|yesterday|last|this week|this month|actual|in my business|for my business)\b/i;
const businessObjects=/\b(sales|revenue|customer|profit|cash|inventory|supplier|expense|orders?|products?)\b/i;
const externalObjects=/\b(market|competitor|industry|regulat|benchmark|trend)\b/i;
const timePattern=/\b(today|yesterday|tomorrow|now|currently|latest|recent|this week|this month|last week|last month|last year|next week|next month|\d{4})\b/i;
const entityPattern=/\b(?:for|about|regarding|on|of)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})/g;

function contextOf(request:string):RequestContext {
  const time=request.match(timePattern)?.[0];
  const business=currentBusiness.test(request)? "current business" : undefined;
  const entities=[...request.matchAll(entityPattern)].map(m=>m[1].trim()).filter(Boolean);
  const scope=businessObjects.test(request) ? request.match(businessObjects)?.[0] : undefined;
  return {business,time,scope,entities};
}

function candidates(request:string) {
  return rules.map(rule => {
    const matches=rule.patterns.filter(p=>p.test(request)).length;
    return {kind:rule.kind,score:matches,reasons:matches?[`Matched ${matches} ${rule.kind} signal(s).`]:[]};
  }).filter(c=>c.score>0).sort((a,b)=>b.score-a.score);
}

export function resolveIntent(input:string):ResolvedIntent{
  const request=input.trim().replace(/\s+/g," ");
  const context=contextOf(request);
  if(!request)return{kind:"unknown",label:"No request yet",normalizedRequest:"",requiredCapabilities:[],needsBusinessData:false,needsExternalResearch:false,ambiguity:"none",candidates:[],context,secondaryIntents:[]};

  const ranked=candidates(request);
  const matched=ranked[0] ? rules.find(r=>r.kind===ranked[0].kind) : undefined;
  const domainCapabilities=businessObjects.test(request) ? (request.match(/\bsales\b/i) ? ["sales"] : []) : [];
  const businessAction=/\b(show|find|list|analy[sz]|investigat|compare|monitor|track|why|how is|how are|check|review)\b/i.test(request);
  const needsBusinessData=currentBusiness.test(request)&&(businessObjects.test(request)||businessAction);
  const needsExternalResearch=externalObjects.test(request)&&(/\b(current|latest|research|find|compare|benchmark|market|competitor|industry|regulat|trend)\b/i.test(request));
  const explicitMultiIntent=/\b(and then|then|after that|and)\b/i.test(request) && ranked.length>1;
  const secondaryIntents=explicitMultiIntent ? ranked.slice(1,3).map(c=>c.kind as IntentKind) : [];

  if(!matched)return{kind:"unknown",label:"Understand the request before choosing a capability",normalizedRequest:request,requiredCapabilities:["intent-resolution",...domainCapabilities],needsBusinessData,needsExternalResearch,ambiguity:"none",candidates:ranked,context,secondaryIntents:[]};
  return{kind:matched.kind,label:matched.label,normalizedRequest:request,requiredCapabilities:[...new Set([...matched.capabilities,...domainCapabilities])],needsBusinessData,needsExternalResearch,ambiguity:secondaryIntents.length?"material":"none",candidates:ranked,context,secondaryIntents};
}
